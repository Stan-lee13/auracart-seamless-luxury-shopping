import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Sparkles, Truck, Shield, HeadphonesIcon, Mail, Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Footer } from '@/components/layout/Footer';

const features = [
  { 
    icon: Truck, 
    title: 'Global Delivery', 
    description: 'Worldwide shipping to your doorstep',
    gradient: 'from-primary/20 to-accent/20'
  },
  { 
    icon: Shield, 
    title: 'Secure Payments', 
    description: 'Protected by Paystack encryption',
    gradient: 'from-accent/20 to-primary/20'
  },
  { 
    icon: Sparkles, 
    title: 'AI Curated', 
    description: 'Smart recommendations personalized for your aura',
    gradient: 'from-primary/20 to-accent/20'
  },
  { 
    icon: HeadphonesIcon, 
    title: '24/7 Support', 
    description: 'Always here to help',
    gradient: 'from-accent/20 to-primary/20'
  },
];

const testimonials = [
  {
    name: 'Adaeze O.',
    location: 'Lagos',
    text: 'AuraCart transformed my shopping experience. The AI recommendations feel like they know my style perfectly.',
    rating: 5
  },
  {
    name: 'Chidi M.',
    location: 'Abuja',
    text: 'Fast delivery, authentic products, and exceptional customer service. My go-to for premium shopping.',
    rating: 5
  },
  {
    name: 'Fatima B.',
    location: 'Port Harcourt',
    text: 'The quality exceeded my expectations. Every purchase feels curated just for me.',
    rating: 5
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Landing() {
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubscribing(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Welcome to the AuraCart family! ✨');
    setEmail('');
    setSubscribing(false);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        
        <div className="container-luxury relative z-10 py-20">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="h-4 w-4" />
              Luxury Meets Technology
            </motion.span>
            
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Discover{' '}
              <span className="text-gradient">Extraordinary</span>
              {' '}Products
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Experience premium shopping with AI-powered recommendations. 
              Our collection is curated to complement your aura and elevate your lifestyle.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="cta-glow btn-luxury text-lg px-8" asChild>
                <Link to="/shop">
                  Shop Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 group" asChild>
                <Link to="/categories">
                  Explore Categories
                  <Zap className="ml-2 h-5 w-5 group-hover:text-primary transition-colors" />
                </Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <motion.div 
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4 text-primary" />
                Secure Checkout
              </span>
              <span className="flex items-center gap-1">
                <Truck className="h-4 w-4 text-primary" />
                Free Shipping 50K+
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-primary" />
                4.9/5 Rating
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container-luxury">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Why Choose <span className="text-gradient">AuraCart</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We bring the world's finest products to your doorstep with unmatched service.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                className={`glass-card p-6 text-center hover-lift bg-gradient-to-br ${feature.gradient}`}
                variants={itemVariants}
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container-luxury">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Loved by Thousands
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Join our community of satisfied customers who've elevated their aura.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="glass-card p-6 hover-lift"
                variants={itemVariants}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-4 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section with Newsletter */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
        <div className="container-luxury text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Ready to Elevate Your <span className="text-gradient">Aura</span>?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of customers experiencing curated collections that enhance your lifestyle and your aura. 
              Subscribe for exclusive offers and new arrivals.
            </p>
            
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-8">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <Button type="submit" className="cta-glow" disabled={subscribing}>
                {subscribing ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </form>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="cta-glow btn-luxury" asChild>
                <Link to="/auth">Create Your Account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/shop">Browse Products</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
