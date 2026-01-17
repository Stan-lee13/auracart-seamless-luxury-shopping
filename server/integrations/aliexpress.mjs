/**
 * AliExpress Dropshipping Backend Client
 * 
 * Based on the Official AliExpress Open Platform Dropshipping Integration Guide.
 * 
 * Features:
 * - Taobao TOP Gateway Integration (gw.api.taobao.com)
 * - MD5 Signing Protocol (TOP Standard)
 * - Dropshipper API Methods (aliexpress.ds.*, aliexpress.trade.buy.*)
 * - Token management (Auth/Refresh)
 * - QPS Rate limiting and automatic retries
 */

import crypto from 'crypto';
import logger from '../logger.mjs';

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const GATEWAY_URL = 'https://gw.api.taobao.com/router/rest';
const SYSTEM_AUTH_BASE = 'https://api-sg.aliexpress.com/rest/2.0';

export class AliExpressClient {
  constructor(options = {}) {
    this.appKey = options.appKey || APP_KEY;
    this.appSecret = options.appSecret || APP_SECRET;
    this.accessToken = options.accessToken || null;
    this._lastRequestTime = 0;
    this._minRequestInterval = 100; // 100ms interval for safety

    if (!this.appKey || !this.appSecret) {
      logger.warn('AliExpress credentials missing. API calls will fail.');
    }
  }

  /**
   * Set the current access token and refresh details
   */
  setToken(data) {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = new Date(data.updated_at).getTime() + (data.expires_in * 1000);
  }

  /**
   * Check if token is expired or close to it (e.g. within 30 mins)
   */
  isTokenExpired() {
    if (!this.expiresAt) return true;
    const thirtyMins = 30 * 60 * 1000;
    return (Date.now() + thirtyMins) > this.expiresAt;
  }

  /**
   * Automatic token maintenance
   */
  async ensureValidToken(supabase) {
    if (this.isTokenExpired() && this.refreshToken) {
      logger.info('AliExpress token expiring soon. Refreshing...');
      const newData = await AliExpressClient.refreshToken(this.refreshToken);

      if (newData.access_token) {
        // Update local state
        const updated_at = new Date().toISOString();
        this.setToken({ ...newData, updated_at });

        // Persist to Supabase
        await supabase.from('settings').update({
          value: {
            ...newData,
            updated_at
          }
        }).eq('key', 'aliexpress_tokens');

        logger.info('AliExpress token refreshed successfully.');
      } else {
        logger.error({ msg: 'Failed to refresh AliExpress token', error: newData });
        throw new Error('AliExpress Re-authentication required.');
      }
    }
  }

  /**
   * Sign request as per Taobao TOP protocol
   * sign = upper(md5(secret + sorted_keys_values + secret))
   */
  _generateSign(params) {
    const sortedKeys = Object.keys(params).sort();
    let query = this.appSecret;

    for (const key of sortedKeys) {
      const val = params[key];
      // Skip empty or binary
      if (val !== undefined && val !== null && typeof val !== 'object') {
        query += key + val;
      } else if (typeof val === 'object') {
        query += key + JSON.stringify(val);
      }
    }

    query += this.appSecret;

    return crypto
      .createHash('md5')
      .update(query, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Throttles API requests to respect rate limits.
   */
  async _throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this._lastRequestTime;

    if (timeSinceLastRequest < this._minRequestInterval) {
      const timeToWait = this._minRequestInterval - timeSinceLastRequest;
      logger.debug(`Throttling: Waiting for ${timeToWait}ms before next request.`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    this._lastRequestTime = Date.now(); // Update last request time after waiting (if any)
  }

  /**
   * Low-level call to API gateway
   */
  async _execute(method, body = {}, sessionRequired = true, retryCount = 0) {
    if (sessionRequired && !this.accessToken) {
      throw new Error(`Method ${method} requires an access token (session).`);
    }

    await this._throttle();

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); // Format: yyyy-MM-dd HH:mm:ss

    const params = {
      method,
      app_key: this.appKey,
      timestamp,
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      ...body
    };

    if (this.accessToken) {
      params.session = this.accessToken;
    }

    params.sign = this._generateSign(params);

    try {
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        body: new URLSearchParams(params).toString()
      });

      const data = await response.json();

      if (data.error_response) {
        const err = data.error_response;

        // Handle common errors mentioned in guide
        if (err.code === 7 || err.code === 33) { // QPS Limit or IP restriction/frequency
          if (retryCount < 3) {
            const backoff = Math.pow(2, retryCount) * 1000;
            logger.warn(`AliExpress QPS Throttling for ${method}. Retrying in ${backoff}ms...`);
            await new Promise(r => setTimeout(r, backoff));
            return this._execute(method, body, sessionRequired, retryCount + 1);
          }
        }

        logger.error({ msg: 'AliExpress API Error', method, code: err.code, sub_msg: err.sub_msg || err.msg });
        throw new Error(`AliExpress Error [${err.code}]: ${err.sub_msg || err.msg}`);
      }

      // Successful responses usually wrap result in [method_name_cleaned]_response
      const responseKey = method.replace(/\./g, '_') + '_response';
      return data[responseKey] || data;
    } catch (e) {
      // Retry for network issues too
      if (retryCount < 3 && (e.message.includes('fetch') || e.message.includes('timeout'))) {
        const backoff = Math.pow(2, retryCount) * 1000;
        logger.warn(`AliExpress network error for ${method}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        return this._execute(method, body, sessionRequired, retryCount + 1);
      }
      logger.error({ msg: 'AliExpress execution exception', method, err: e.message });
      throw e;
    }
  }

  // --- PRODUCT APIs ---

  /**
   * Get bestseller feed (Recommended for Dropshippers)
   * Method: aliexpress.ds.recommend.feed.get
   */
  async getBestsellerFeed({ feedName = 'DS bestseller', categoryId, pageNo = 1, pageSize = 50 } = {}) {
    const params = {
      feed_name: feedName,
      page_no: pageNo,
      page_size: pageSize
    };
    if (categoryId) params.category_id = categoryId;

    return this._execute('aliexpress.ds.recommend.feed.get', params);
  }

  /**
   * Get full product details (Dropshipper API)
   * Method: aliexpress.ds.product.get
   */
  async getProduct(productId, { language = 'en', shipToCountry = 'US', currency = 'USD' } = {}) {
    return this._execute('aliexpress.ds.product.get', {
      product_id: productId,
      local_language: language,
      ship_to_country: shipToCountry,
      local_currency: currency
    });
  }

  // --- TRADE / ORDER APIs ---

  /**
   * Place Order (Dropshipper Order API)
   * Method: aliexpress.trade.buy.placeorder
   * Note: Guide specific complex request body
   */
  async placeOrder(orderRequest) {
    // orderRequest should match PlaceOrderRequest4OpenApiDto
    return this._execute('aliexpress.trade.buy.placeorder', {
      param_place_order_request4_open_api_dto: JSON.stringify(orderRequest)
    });
  }

  /**
   * Query Order Detail (Dropshipper Order API)
   * Method: aliexpress.trade.ds.order.get
   */
  async getOrderDetail(orderId) {
    return this._execute('aliexpress.trade.ds.order.get', {
      single_order_query: JSON.stringify({ order_id: orderId })
    });
  }

  /**
   * Query Tracking Info
   * Method: aliexpress.logistics.ds.trackinginfo.query
   */
  async getTrackingInfo({ trackingNo, serviceName, orderId }) {
    return this._execute('aliexpress.logistics.ds.trackinginfo.query', {
      tracking_no: trackingNo,
      logistics_service_name: serviceName,
      out_ref: orderId
    });
  }

  // --- SYSTEM / AUTH ---

  /**
   * Exchange Code for Token
   * Endpoint: /auth/token/create
   */
  static async createToken(code) {
    // Note: Guide says use api-sg.aliexpress.com for auth
    const url = `${SYSTEM_AUTH_BASE}/auth/token/create`;
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    return response.json();
  }

  /**
   * Refresh Token
   * Endpoint: /auth/token/refresh
   */
  static async refreshToken(refreshToken) {
    const url = `${SYSTEM_AUTH_BASE}/auth/token/refresh`;
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    return response.json();
  }
}

export default AliExpressClient;
