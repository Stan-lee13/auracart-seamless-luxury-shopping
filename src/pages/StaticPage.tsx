import { useLocation, Link } from 'react-router-dom';
import { BackButton } from '@/components/navigation/BackButton';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

const pages: Record<string, { title: string; content: React.ReactNode }> = {
  '/contact': {
    title: 'Contact Us',
    content: (
      <div className="space-y-4">
        <p>We'd love to hear from you. Reach out to us anytime!</p>
        <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><span>auracart4u@gmail.com</span></div>
        <p className="text-muted-foreground">We typically respond within 24 hours.</p>
      </div>
    ),
  },
  '/faq': {
    title: 'Frequently Asked Questions',
    content: (
      <div className="space-y-6">
        <div><h3 className="font-semibold">How long does shipping take?</h3><p className="text-muted-foreground">Standard international shipping takes 7-14 business days. Express options are available for select regions.</p></div>
        <div><h3 className="font-semibold">What payment methods do you accept?</h3><p className="text-muted-foreground">We accept all major cards, bank transfers, and mobile money through Paystack.</p></div>
        <div><h3 className="font-semibold">How do I return an item?</h3><p className="text-muted-foreground">Contact us within 7 days of delivery and we'll guide you through the return process.</p></div>
        <div><h3 className="font-semibold">Do you ship internationally?</h3><p className="text-muted-foreground">Yes! We ship to most countries worldwide.</p></div>
      </div>
    ),
  },
  '/shipping': {
    title: 'Shipping Information',
    content: (
      <div className="space-y-4">
        <p>Free shipping on all orders over ₦50,000!</p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>Standard shipping: 7-14 business days</li>
          <li>Express shipping: 3-7 business days (select regions)</li>
          <li>All packages are tracked and insured</li>
          <li>Orders are processed within 24-48 hours</li>
        </ul>
      </div>
    ),
  },
  '/returns': {
    title: 'Returns & Refunds',
    content: (
      <div className="space-y-4">
        <p>We want you to be completely satisfied with your purchase.</p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>7-day return policy from date of delivery</li>
          <li>Items must be unused and in original packaging</li>
          <li>Refunds are processed within 5-10 business days</li>
          <li>Contact auracart4u@gmail.com to initiate a return</li>
        </ul>
      </div>
    ),
  },
  '/track-order': {
    title: 'Track Your Order',
    content: (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">You can track your orders from your account page.</p>
        <Button asChild><Link to="/orders">View My Orders</Link></Button>
      </div>
    ),
  },
  '/about': {
    title: 'About AuraCart',
    content: (
      <div className="space-y-4">
        <p>AuraCart is a premium e-commerce platform that curates extraordinary products from around the world.</p>
        <p className="text-muted-foreground">Our mission is to make luxury accessible. We source the finest products and deliver them to your doorstep with care and precision.</p>
        <p className="text-muted-foreground">Founded with the belief that everyone deserves to experience quality, we combine AI-powered curation with global sourcing to bring you products that elevate your lifestyle.</p>
      </div>
    ),
  },
  '/privacy': {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-4 text-muted-foreground">
        <p>Your privacy is important to us. We collect only the information necessary to process your orders and improve your shopping experience.</p>
        <p>We never sell your personal data to third parties. All payment information is processed securely through Paystack.</p>
        <p>Contact us at auracart4u@gmail.com for any privacy-related inquiries.</p>
      </div>
    ),
  },
  '/terms': {
    title: 'Terms of Service',
    content: (
      <div className="space-y-4 text-muted-foreground">
        <p>By using AuraCart, you agree to these terms. Please read them carefully.</p>
        <p>All products are subject to availability. Prices may change without notice. We reserve the right to refuse service to anyone.</p>
        <p>For the complete terms, contact us at auracart4u@gmail.com.</p>
      </div>
    ),
  },
};

export default function StaticPage() {
  const location = useLocation();
  const page = pages[location.pathname];

  if (!page) return null;

  return (
    <div className="min-h-screen">
      <div className="container-luxury py-8">
        <BackButton />
        <Card className="glass-card mt-6 max-w-3xl mx-auto">
          <CardHeader><CardTitle className="text-2xl">{page.title}</CardTitle></CardHeader>
          <CardContent>{page.content}</CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
