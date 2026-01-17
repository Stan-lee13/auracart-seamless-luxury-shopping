/**
 * AliExpress Integration Module
 * 
 * Provides client for:
 * - Product search and catalog sync
 * - Order creation and tracking
 * - Inventory synchronization
 * - Supplier messaging
 * 
 * Requires ALIEXPRESS_API_KEY and ALIEXPRESS_API_SECRET environment variables
 */

import logger from '../logger.mjs';

const ALIEXPRESS_API_KEY = process.env.ALIEXPRESS_API_KEY;
const ALIEXPRESS_API_SECRET = process.env.ALIEXPRESS_API_SECRET;
const ALIEXPRESS_API_BASE = 'https://openapi.aliexpress.com/router/rest';

/**
 * AliExpress API Client
 */
export class AliExpressClient {
  constructor(apiKey = ALIEXPRESS_API_KEY, apiSecret = ALIEXPRESS_API_SECRET) {
    if (!apiKey || !apiSecret) {
      logger.warn('AliExpress credentials not configured — API calls will fail');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Build request signature for AliExpress API
   */
  async _buildSignature(params) {
    // Sort parameters and build query string
    const sortedKeys = Object.keys(params).sort();
    let queryString = '';
    for (const key of sortedKeys) {
      const value = params[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          queryString += `${key}=${encodeURIComponent(JSON.stringify(item))}&`;
        }
      } else {
        queryString += `${key}=${encodeURIComponent(value)}&`;
      }
    }

    // Sign with secret
    const crypto = await import('crypto');
    const { createHmac } = crypto;
    const hmac = createHmac('sha256', this.apiSecret);
    hmac.update(queryString);
    return hmac.digest('hex').toUpperCase();
  }

  /**
   * Search products on AliExpress
   */
  async searchProducts(keyword, { limit = 20, offset = 0, sortBy = 'total_tranpro_cask' } = {}) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.postproduct.redefining.querystoreproduct',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        keyword,
        limit,
        offset,
        sort_by: sortBy
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress search failed', keyword, error: data });
        return { error: data.error_response?.msg || 'Search failed', items: [] };
      }

      return {
        items: data.resp_result?.products || [],
        total: data.resp_result?.total_count || 0
      };
    } catch (e) {
      logger.error({ msg: 'AliExpress search exception', keyword, err: String(e) });
      return { error: String(e), items: [] };
    }
  }

  /**
   * Get product details
   */
  async getProductDetails(productId) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.postproduct.redefining.productdetail',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        product_id: productId
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress product detail failed', productId, error: data });
        return { error: data.error_response?.msg || 'Fetch failed' };
      }

      return { data: data.resp_result?.product || null };
    } catch (e) {
      logger.error({ msg: 'AliExpress product detail exception', productId, err: String(e) });
      return { error: String(e) };
    }
  }

  /**
   * Check inventory for a product
   */
  async checkInventory(productId, skuId = null) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.postproduct.redefining.getinventory',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        product_id: productId,
        sku_id: skuId
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress inventory check failed', productId, error: data });
        return { error: data.error_response?.msg || 'Inventory check failed', available: false };
      }

      const inventory = data.resp_result?.inventory || {};
      return {
        available: inventory.available_quantity > 0,
        quantity: inventory.available_quantity || 0,
        bulk_discount: inventory.bulk_discount || []
      };
    } catch (e) {
      logger.error({ msg: 'AliExpress inventory check exception', productId, err: String(e) });
      return { error: String(e), available: false };
    }
  }

  /**
   * Submit order to AliExpress (order creation request)
   */
  async submitOrder({ productId, skuId, quantity, shippingAddress, contactInfo }) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.order.createorder',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        product_id: productId,
        sku_id: skuId,
        qty: quantity,
        address_name: shippingAddress?.name,
        address_country: shippingAddress?.country || 'NG',
        address_state: shippingAddress?.state,
        address_city: shippingAddress?.city,
        address_detail: shippingAddress?.street,
        address_postal_code: shippingAddress?.postal_code,
        address_phone_number: contactInfo?.phone,
        buyer_email: contactInfo?.email
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress order submit failed', productId, error: data });
        return { error: data.error_response?.msg || 'Order submit failed' };
      }

      const order = data.resp_result?.order || {};
      return {
        success: true,
        order_id: order.order_id,
        trade_id: order.trade_id,
        status: 'pending',
        estimated_delivery: order.estimated_delivery_date
      };
    } catch (e) {
      logger.error({ msg: 'AliExpress order submit exception', productId, err: String(e) });
      return { error: String(e) };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(tradeId) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.order.getorderdetail',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        trade_id: tradeId
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress order status check failed', tradeId, error: data });
        return { error: data.error_response?.msg || 'Status check failed' };
      }

      const order = data.resp_result?.order || {};
      return {
        trade_id: order.trade_id,
        status: order.trade_status,
        status_text: order.status_text,
        logistics_status: order.logistics_status,
        logistics_status_text: order.logistics_status_text,
        estimated_delivery: order.estimated_delivery_date,
        tracking_number: order.tracking_no
      };
    } catch (e) {
      logger.error({ msg: 'AliExpress order status check exception', tradeId, err: String(e) });
      return { error: String(e) };
    }
  }

  /**
   * Cancel order on AliExpress
   */
  async cancelOrder(tradeId, reason = 'Cancelled by merchant') {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('AliExpress API credentials not configured');
    }

    try {
      const params = {
        app_key: this.apiKey,
        timestamp: Date.now(),
        method: 'aliexpress.order.cancelorder',
        format: 'json',
        v: '2.0',
        sign_type: 'MD5'
      };

      const body = {
        trade_id: tradeId,
        cancel_reason: reason
      };

      const resp = await fetch(ALIEXPRESS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, ...body })
      });

      const data = await resp.json();
      if (!resp.ok || data.error_response) {
        logger.error({ msg: 'AliExpress order cancel failed', tradeId, error: data });
        return { error: data.error_response?.msg || 'Cancel failed', success: false };
      }

      return { success: true, message: 'Order cancelled' };
    } catch (e) {
      logger.error({ msg: 'AliExpress order cancel exception', tradeId, err: String(e) });
      return { error: String(e), success: false };
    }
  }
}

export default AliExpressClient;
