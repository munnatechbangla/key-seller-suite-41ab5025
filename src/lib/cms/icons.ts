import {
  Zap, Shield, Headphones, RefreshCw, Star, ArrowRight, Check, Play, Sparkles,
  Gift, Clock, Users, Award, ChevronRight, Facebook, Twitter, Instagram, Youtube,
  Send, Sun, Moon, Monitor, Linkedin, Github, MessageSquare, Mail, Globe,
  type LucideIcon,
} from "lucide-react";

export const iconRegistry = {
  Zap, Shield, Headphones, RefreshCw, Star, ArrowRight, Check, Play, Sparkles,
  Gift, Clock, Users, Award, ChevronRight, Facebook, Twitter, Instagram, Youtube,
  Send, Sun, Moon, Monitor, Linkedin, Github, MessageSquare, Mail, Globe,
} as const;

export type IconName = keyof typeof iconRegistry;

export function resolveIcon(name: IconName): LucideIcon {
  return iconRegistry[name];
}
