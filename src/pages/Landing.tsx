import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Truck, Shield, HeadphonesIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/Footer';

const features = [
  { icon: Truck, title: 'Global Delivery', description: 'Delivered to your doorstep, worldwide' },
  { icon: Shield, title: 'Secure Payments', description: 'Protected by Paystack encryption' },
  { icon: Sparkles, title: 'AI Curated', description: 'Personalized to your unique taste' },
  { icon: HeadphonesIcon, title: '24/7 Support', description: 'We are here when you need us' },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        <div className="container-luxury relative z-10 py-20">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span 
              className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              ✨ Curated for refined taste
            </motion.span>
            
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Pieces That{' '}
              <span className="text-gradient">Quietly Elevate</span>
              {' '}Your Presence
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Designed to complement your aura, not compete with it. 
              Discover products curated with intention, delivered with care.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="cta-glow btn-luxury text-lg px-8" asChild>
                <Link to="/auth?mode=register">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                <Link to="/shop">Browse Collection</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container-luxury">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="glass-card p-6 text-center hover-lift"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20">
        <div className="container-luxury">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h2 
              className="font-serif text-3xl md:text-4xl font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Refinement doesn't have to be expensive.
            </motion.h2>
            <motion.p 
              className="text-muted-foreground text-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              We source directly from artisans and manufacturers around the world, 
              bringing you exceptional quality at prices that make sense.
            </motion.p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container-luxury text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Ready to discover your style?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands who trust AuraCart for products that speak to who they are.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="cta-glow" asChild>
                <Link to="/auth?mode=register">Create Your Account</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/auth?mode=login">Sign In</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - only on landing page */}
      <Footer />
    </div>
  );
}
