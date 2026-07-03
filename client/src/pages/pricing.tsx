import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Check, 
  Star, 
  ArrowRight,
  Phone,
  Users,
  BarChart3,
  Shield,
  Headphones,
  Zap
} from "lucide-react";

interface PricingPlan {
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  popular?: boolean;
  cta: string;
  stripePriceId: {
    monthly: string;
    yearly: string;
  };
}

const plans: PricingPlan[] = [
  {
    name: "Starter",
    description: "Perfect for small teams getting started",
    price: {
      monthly: 29,
      yearly: 24
    },
    features: [
      "Up to 5 producers",
      "1,000 call minutes/month",
      "Basic WebRTC calling",
      "Standard analytics",
      "Email support",
      "Mobile app access"
    ],
    cta: "Get Started",
    stripePriceId: {
      monthly: "price_starter_monthly",
      yearly: "price_starter_yearly"
    }
  },
  {
    name: "Professional",
    description: "For growing call centers with advanced needs",
    price: {
      monthly: 79,
      yearly: 65
    },
    features: [
      "Up to 25 producers",
      "5,000 call minutes/month",
      "Advanced WebRTC features",
      "VDP call routing",
      "Real-time analytics",
      "AO Precheck verification",
      "Priority support",
      "Custom integrations",
      "Gamification features"
    ],
    popular: true,
    cta: "Get Started",
    stripePriceId: {
      monthly: "price_pro_monthly",
      yearly: "price_pro_yearly"
    }
  },
  {
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: {
      monthly: 199,
      yearly: 165
    },
    features: [
      "Unlimited producers",
      "Unlimited call minutes",
      "Enterprise WebRTC",
      "Advanced VDP routing",
      "Custom analytics dashboard",
      "White-label solution",
      "24/7 dedicated support",
      "Custom integrations",
      "Advanced gamification",
      "SLA guarantees",
      "Custom training"
    ],
    cta: "Contact Sales",
    stripePriceId: {
      monthly: "price_enterprise_monthly",
      yearly: "price_enterprise_yearly"
    }
  }
];

const features = [
  {
    icon: Phone,
    title: "WebRTC Calling",
    description: "Crystal clear browser-based calling with no hardware required"
  },
  {
    icon: Users,
    title: "Producer Management",
    description: "Complete producer profiles, permissions, and performance tracking"
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Real-time dashboards and comprehensive reporting"
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption and compliance features"
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Expert support when you need it most"
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized for performance and reliability"
  }
];

const faqs = [
  {
    question: "How do I get started?",
    answer: "Create an account and subscribe to the plan that fits your needs. You can upgrade or downgrade anytime."
  },
  {
    question: "Can I change plans anytime?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle."
  },
  {
    question: "What's included in call minutes?",
    answer: "Call minutes include both inbound and outbound calls. Additional minutes can be purchased as needed."
  },
  {
    question: "Do you offer custom enterprise solutions?",
    answer: "Yes, we work with large organizations to create custom solutions that meet specific requirements."
  },
  {
    question: "Is there a setup fee?",
    answer: "No setup fees. You only pay for your monthly or yearly subscription."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards and ACH payments for annual plans."
  }
];

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AO</span>
                </div>
                <span className="text-xl font-bold text-gray-900">ConnectNow</span>
              </div>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/join">
                <Button className="bg-purple-600 hover:bg-purple-700">Get your account</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Choose the perfect plan for your call center. Subscribe today and scale as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-12">
            <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-purple-600"
            />
            <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
            </span>
            <Badge className="bg-green-100 text-green-600 ml-2">Save 20%</Badge>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative hover:shadow-xl transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-purple-600 scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </CardTitle>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">
                        ${isYearly ? plan.price.yearly : plan.price.monthly}
                      </span>
                      <span className="text-gray-600 ml-1">/month</span>
                    </div>
                    {isYearly && (
                      <div className="text-sm text-green-600 font-medium">
                        Save ${(plan.price.monthly - plan.price.yearly) * 12}/year
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link href={plan.name === "Enterprise" ? "/contact" : "/join"}>
                    <Button 
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-purple-600 hover:bg-purple-700' 
                          : 'bg-gray-900 hover:bg-gray-800'
                      }`}
                      size="lg"
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need Included
            </h2>
            <p className="text-xl text-gray-600">
              All plans include these essential call center features
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center">
                  <Icon className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Have questions? We have answers.
            </p>
          </div>
          
          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join thousands of call centers already using ConnectNow to transform their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                Get your account
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}