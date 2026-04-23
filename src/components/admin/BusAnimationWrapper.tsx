import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bus } from "lucide-react";

interface BusAnimationWrapperProps {
  children: React.ReactNode;
  onAnimationComplete?: () => void;
}

export const BusAnimationWrapper: React.FC<BusAnimationWrapperProps> = ({ children, onAnimationComplete }) => {
  const [showContent, setShowContent] = useState(false);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    // Stage 1: Bus drives in
    // Stage 2: Bus vanishes/transforms into the seat map
    const timer = setTimeout(() => {
      setAnimating(false);
      setShowContent(true);
      onAnimationComplete?.();
    }, 2500); // Animation duration

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center min-h-[400px]">
      <AnimatePresence>
        {animating && (
          <motion.div
            initial={{ x: "-100vw", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ 
              duration: 1.5, 
              ease: "easeOut"
            }}
            className="flex flex-col items-center gap-4"
          >
            {/* Stylized Bus Shape */}
            <div className="relative">
              <div className="w-64 h-32 bg-sky-500 rounded-2xl border-b-8 border-r-8 border-sky-700 flex items-center justify-end pr-8">
                {/* Windows */}
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-sky-200 rounded-sm opacity-50" />
                  <div className="w-8 h-8 bg-sky-200 rounded-sm opacity-50" />
                  <div className="w-8 h-8 bg-sky-200 rounded-sm opacity-50" />
                </div>
              </div>
              {/* Wheels */}
              <div className="absolute -bottom-4 left-8 w-10 h-10 bg-slate-800 rounded-full border-4 border-slate-600 animate-spin-slow" />
              <div className="absolute -bottom-4 right-8 w-10 h-10 bg-slate-800 rounded-full border-4 border-slate-600 animate-spin-slow" />
              
              {/* Headlight */}
              <motion.div 
                animate={{ opacity: [1, 0.5, 1] }} 
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-yellow-300 rounded-l-full shadow-[10px_0_20px_rgba(253,224,71,0.5)]" 
              />
            </div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-sky-600"
            >
              Consultando Disponibilidade...
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
