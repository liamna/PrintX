import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, Link as LinkIcon, Mail, 
  MessageSquare, ArrowRight, CheckCircle2, MapPin, 
  Home, Send, AlertCircle, Upload, ShieldCheck, 
  ExternalLink, Accessibility, Activity, File as FileIcon,
  ShoppingCart, Trash2, Plus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

type CartItem = {
  id: string;
  modelUrl: string;
  modelName: string;
  modelCost: number;
  materialCost: number;
  profitMargin: number;
  itemTotal: number;
  printTimeHours: number;
};

export default function App() {
  const [appStep, setAppStep] = useState<'landing' | 'terms' | 'quoting' | 'cart' | 'checkout' | 'success'>('landing');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Landing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [landingUrl, setLandingUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showDisability, setShowDisability] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentModelRef, setCurrentModelRef] = useState<{ url: string, file: File | null }>({ url: '', file: null });

  // Form values
  const [formData, setFormData] = useState({
    email: '',
    country: '',
    city: '',
    address: '',
    instructions: ''
  });

  const [isSending, setIsSending] = useState(false);

  const activeModelReference = selectedFile ? `Uploaded File: ${selectedFile.name}` : landingUrl;
  
  const shippingCost = cart.length > 0 ? 8 + ((cart.length - 1) * 2) : 0; // Base $8 + $2 per extra item
  const cartSubtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const cartTotal = cartSubtotal + shippingCost;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setLandingUrl('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setLandingUrl('');
    }
  };

  const startQuoteProcess = () => {
    if (!activeModelReference) return;
    setCurrentModelRef({ url: landingUrl, file: selectedFile });
    setAppStep('terms');
  };

  const handleGetQuote = async () => {
    setAppStep('quoting');
    setErrorMsg('');
    
    try {
      const modelIdentifier = currentModelRef.file ? `File: ${currentModelRef.file.name}` : currentModelRef.url;
      
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelUrl: modelIdentifier })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get quote');
      }
      
      const newItem: CartItem = {
        id: Date.now().toString(),
        modelUrl: modelIdentifier,
        modelName: data.modelName,
        modelCost: data.modelCost,
        materialCost: data.materialCost,
        profitMargin: data.profitMargin,
        itemTotal: data.itemTotal,
        printTimeHours: data.printTimeHours,
      };

      setCart(prev => [...prev, newItem]);
      setAppStep('cart');
      
      // Reset landing state
      setLandingUrl('');
      setSelectedFile(null);
      setCurrentModelRef({ url: '', file: null });

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while generating your quote.');
      setAppStep('landing');
    }
  };

  const removeFromCart = (id: string) => {
    const updatedCart = cart.filter(item => item.id !== id);
    setCart(updatedCart);
    if (updatedCart.length === 0) {
       setAppStep('landing');
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsSending(true);
    setErrorMsg('');

    try {
      // Run both tasks in parallel to speed up the place order action
      const [emailRes, docRef] = await Promise.all([
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customer: formData, 
            cart,
            total: cartTotal
          })
        }).then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(`Email failed: ${data.details?.message || data.error || 'Unknown error'}. Order was still saved to database.`);
          }
          return res;
        }),
        addDoc(collection(db, 'orders'), {
          customer: formData,
          items: cart,
          subtotal: cartSubtotal,
          shipping: shippingCost,
          total: cartTotal,
          status: 'pending',
          createdAt: serverTimestamp()
        })
      ]);
      
      setCart([]);
      setAppStep('success');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-display font-bold text-xl tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setAppStep('landing')}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            Print<span className="text-indigo-400">X</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-slate-400 hidden sm:block">Concierge Printing</span>
            <button 
              onClick={() => { if(cart.length > 0) setAppStep('cart') }}
              className={`relative p-2 transition-colors ${cart.length > 0 ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-600 cursor-not-allowed'}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 lg:py-20 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* ===================== LANDING PAGE ===================== */}
          {appStep === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto w-full"
            >
              {errorMsg && (
                <div className="mb-6 max-w-lg mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="text-center mb-12">
                <h1 className="text-5xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1] mb-6">
                  You find it.<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                    We print it.
                  </span>
                </h1>
                <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  The easiest way to get physical 3D models. Drop a file, paste a link from a popular database, and let us handle purchasing, printing, and shipping.
                </p>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-3xl p-8 mb-8 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 pointer-events-none" />
                
                {/* Drag and Drop Zone */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative z-10 ${
                    isDragging 
                      ? 'border-indigo-400 bg-indigo-500/10' 
                      : selectedFile 
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-white/10 bg-black/40 hover:border-white/30 hover:bg-black/60'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect}
                    accept=".stl,.obj,.step,.3mf"
                  />
                  
                  {selectedFile ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                        <FileIcon className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">{selectedFile.name}</h3>
                      <p className="text-slate-400 text-sm">File attached. Click or drag to replace.</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                        <Upload className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">Drag & Drop your 3D file</h3>
                      <p className="text-slate-400 text-sm">Supports STL, OBJ, STEP, and 3MF up to 100MB</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 py-8">
                  <div className="h-px bg-white/10 flex-1" />
                  <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">OR PASTE A LINK</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                {/* Link Input */}
                <div className="relative z-10">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="url"
                    value={landingUrl}
                    onChange={(e) => {
                      setLandingUrl(e.target.value);
                      if (e.target.value) setSelectedFile(null); // Clear file if URL typed
                    }}
                    className={`block w-full pl-12 pr-4 py-4 bg-black/40 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                      landingUrl && !selectedFile ? 'border-indigo-500/50' : 'border-white/10'
                    }`}
                    placeholder="https://thingiverse.com/..."
                  />
                </div>

                {/* Model Databases Links */}
                <div className="mt-8 text-center relative z-10">
                  <div className="text-xs text-slate-500 mb-4 uppercase tracking-wider font-medium">Browse Popular Repositories</div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <RepositoryLink href="https://makerworld.com/" label="MakerWorld" />
                    <RepositoryLink href="https://www.thingiverse.com/" label="Thingiverse" />
                    <RepositoryLink href="https://cults3d.com/" label="Cults3D" />
                    <RepositoryLink href="https://www.yeggi.com/" label="Yeggi" />
                  </div>
                </div>

                {/* Disability Center */}
                <div className="mt-8 pt-6 border-t border-white/10 text-center relative z-10">
                  <button 
                    onClick={() => setShowDisability(!showDisability)}
                    className="text-slate-500 hover:text-indigo-400 text-sm font-medium transition-colors border border-transparent hover:border-indigo-500/30 px-4 py-2 rounded-lg"
                  >
                    Disability Center
                  </button>
                  
                  <AnimatePresence>
                    {showDisability && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                      >
                        <div className="flex flex-col sm:flex-row justify-center gap-4 pb-4">
                          <a 
                            href="https://www.yeggi.com/q/locomotive+dissability/"
                            target="_blank" rel="noreferrer"
                            className="flex items-center justify-center gap-3 px-5 py-3 bg-slate-900/80 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-2xl transition-all group lg:text-sm"
                          >
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                              <Activity className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-slate-300 group-hover:text-white">Locomotive Disability</span>
                          </a>
                          <a 
                            href="https://www.yeggi.com/q/prostetic+limb/"
                            target="_blank" rel="noreferrer"
                            className="flex items-center justify-center gap-3 px-5 py-3 bg-slate-900/80 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all group lg:text-sm"
                          >
                            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                              <Accessibility className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-slate-300 group-hover:text-white">Missing Limb</span>
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={startQuoteProcess}
                  disabled={!activeModelReference}
                  className="inline-flex items-center justify-center gap-2 py-4 px-12 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-lg rounded-full font-semibold transition-all shadow-xl shadow-indigo-500/20"
                >
                  Order Model
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ===================== QUOTING STATE ===================== */}
          {appStep === 'quoting' && (
            <motion.div 
              key="quoting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center text-center max-w-md mx-auto"
            >
              <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <Printer className="w-10 h-10 text-indigo-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-display font-bold text-white mb-3">Estimating Cost...</h2>
              <p className="text-slate-400">
                Our AI is analyzing the model geometry, generating supports, and calculating material usage to get you the best price.
              </p>
            </motion.div>
          )}

          {/* ===================== TERMS PAGE ===================== */}
          {appStep === 'terms' && (
            <motion.div 
              key="terms"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto w-full bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-12 shadow-2xl relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-cyan-500/5 rounded-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center mb-8 gap-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-display font-bold text-white">Terms & Services</h2>
                    <p className="text-slate-400 text-sm mt-1">Please review before proceeding</p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 h-72 overflow-y-auto mb-8 text-sm text-slate-400 space-y-4 custom-scrollbar">
                  <p>Welcome to PrintX Concierge. By proceeding to order, you agree to the following conditions regarding our 3D printing and fulfillment service:</p>
                  
                  <h3 className="text-white font-medium text-base mt-6">1. Service Scope</h3>
                  <p>We act strictly as a printing concierge. We will purchase the requested 3D model link on your behalf (if premium), slice it, and print it using our provided materials.</p>
                  
                  <h3 className="text-white font-medium text-base mt-6">2. Copyright & Intellectual Property</h3>
                  <p>You must ensure the model you request is legally available for purchase, open source, or free. We print items strictly for your personal use. You may not use our service to reproduce models for commercial resale.</p>
                  
                  <h3 className="text-white font-medium text-base mt-6">3. Prohibited Items</h3>
                  <p>We will not print weapons, illegal items, hate speech symbols, or sexually explicit content.</p>
                  
                  <h3 className="text-white font-medium text-base mt-6">4. Quoting & Costs</h3>
                  <p>The quote generated by our AI is a high-accuracy estimate. Final costs may vary slightly based on actual print time complexity.</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                  <button 
                    onClick={() => setAppStep('landing')}
                    className="px-6 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors font-medium"
                  >
                    Decline & Go Back
                  </button>
                  <button 
                    onClick={handleGetQuote}
                    className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    I Accept & Get Quote
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================== CART PAGE ===================== */}
          {appStep === 'cart' && (
            <motion.div 
              key="cart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center gap-3 mb-8">
                <button 
                  onClick={() => setAppStep('landing')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ← Continue Shopping
                </button>
              </div>

              <h2 className="text-4xl font-display font-bold tracking-tight mb-8">Your Cart</h2>

              {cart.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-white/10">
                  <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Your cart is empty.</p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-12 gap-8">
                  {/* Cart Items List */}
                  <div className="lg:col-span-8 space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex gap-4">
                        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-400">
                          <Printer className="w-8 h-8" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-medium text-white truncate pr-4">{item.modelName}</h3>
                              <p className="text-xs text-slate-500 truncate max-w-[250px] sm:max-w-sm mt-1">{item.modelUrl}</p>
                            </div>
                            <div className="text-xl font-mono font-bold text-emerald-400 flex-shrink-0">${item.itemTotal.toFixed(2)}</div>
                          </div>
                          
                          <div className="mt-4 flex gap-4 text-xs text-slate-400 font-mono">
                            <div className="truncate">File: ${item.modelCost.toFixed(2)}</div>
                            <div className="truncate">Material: ${item.materialCost.toFixed(2)}</div>
                            <div className="truncate">Assembly: ${item.profitMargin.toFixed(2)}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="self-center p-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}

                    <button 
                      onClick={() => setAppStep('landing')}
                      className="w-full py-5 border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-400 transition-all font-medium mt-4"
                    >
                      <Plus className="w-5 h-5" />
                      Add Another Model
                    </button>
                  </div>

                  {/* Summary / Checkout panel */}
                  <div className="lg:col-span-4 sticky top-32 h-fit">
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                      <h3 className="text-xl font-display font-medium text-white mb-6 border-b border-white/10 pb-4">Order Summary</h3>
                      
                      <div className="space-y-3 mb-6 text-sm">
                        <div className="flex justify-between text-slate-300">
                          <span>Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                          <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Estimated Shipping</span>
                          <span className="font-mono">${shippingCost.toFixed(2)}</span>
                        </div>
                        <div className="pt-5 border-t border-white/10 flex justify-between items-end mt-4">
                          <span className="text-base font-medium text-white">Grand Total</span>
                          <span className="text-3xl font-display font-bold text-emerald-400 font-mono tracking-tight">
                            ${cartTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setAppStep('checkout')}
                        className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Proceed to Checkout
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ===================== CHECKOUT FORM ===================== */}
          {appStep === 'checkout' && (
            <motion.div 
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto w-full"
            >
              <div className="mb-8">
                <button 
                  onClick={() => setAppStep('cart')}
                  className="text-sm text-slate-400 hover:text-white mb-6 flex items-center gap-2 transition-colors w-fit"
                >
                  ← Back to Cart
                </button>
                <h2 className="text-4xl font-display font-bold tracking-tight mb-2">Checkout Details</h2>
                <p className="text-slate-400 text-sm">Where should we securely ship your printed models?</p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="grid lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7">
                  <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-10 shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-cyan-500/5 rounded-3xl blur-3xl -z-10" />
                    <form id="checkout-form" onSubmit={handleConfirmOrder} className="space-y-4">
                      {/* Contact */}
                      <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                        <div>
                          <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                            Your Contact Email *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Mail className="h-4 w-4 text-slate-500" />
                            </div>
                            <input
                              type="email"
                              required
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              className="block w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                              placeholder="you@email.com"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="p-5 bg-black/20 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Country *</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                               <MapPin className="h-4 w-4 text-slate-500" />
                            </div>
                            <input
                              type="text"
                              required
                              value={formData.country}
                              onChange={(e) => setFormData({...formData, country: e.target.value})}
                              className="block w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                              placeholder="e.g. United States"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">City *</label>
                          <input
                            type="text"
                            required
                            value={formData.city}
                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                            className="block w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            placeholder="City"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Address *</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                               <Home className="h-4 w-4 text-slate-500" />
                            </div>
                            <input
                              type="text"
                              required
                              value={formData.address}
                              onChange={(e) => setFormData({...formData, address: e.target.value})}
                              className="block w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                              placeholder="123 Main St"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider flex justify-between">
                          <span>Global Instructions</span>
                          <span className="text-slate-600">Optional</span>
                        </label>
                        <div className="relative">
                          <div className="absolute top-3 left-3.5 pointer-events-none">
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                          </div>
                          <textarea
                            rows={3}
                            value={formData.instructions}
                            onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                            className="block w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm custom-scrollbar"
                            placeholder="Please print everything in dark green PLA if possible..."
                          ></textarea>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-5 h-fit sticky top-32">
                   <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                      <h3 className="text-xl font-display font-medium text-white mb-6 border-b border-white/10 pb-4">
                        Order Snapshot
                      </h3>

                      <div className="space-y-4 mb-6 text-sm max-h-64 overflow-y-auto custom-scrollbar">
                        {cart.map((item) => (
                           <div key={item.id} className="flex justify-between items-start pb-2 border-b border-white/5">
                             <div className="truncate pr-4 w-2/3">
                               <div className="text-slate-300 truncate">{item.modelName}</div>
                             </div>
                             <div className="font-mono text-white">${item.itemTotal.toFixed(2)}</div>
                           </div>
                        ))}
                      </div>

                      <div className="space-y-3 mb-6 text-sm">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal</span>
                          <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Shipping</span>
                          <span className="font-mono">${shippingCost.toFixed(2)}</span>
                        </div>
                        <div className="pt-5 border-t border-white/10 flex justify-between items-end mt-4">
                          <span className="text-base font-medium text-white">Grand Total</span>
                          <span className="text-3xl font-display font-bold text-emerald-400 font-mono tracking-tight">
                            ${cartTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        form="checkout-form"
                        disabled={isSending}
                        className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all group shadow-lg shadow-emerald-500/20"
                      >
                        {isSending ? (
                          <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Finalizing Order...
                          </>
                        ) : (
                          <>
                            Place Order (${cartTotal.toFixed(2)})
                            <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================== SUCCESS PAGE ===================== */}
          {appStep === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center text-center py-12 max-w-md mx-auto"
            >
              <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
              <h3 className="text-4xl font-display font-bold text-white mb-4 tracking-tight">Order Confirmed!</h3>
              <p className="text-slate-400 text-lg mb-8">
                Your print order has been securely saved. We'll verify your models and send a confirmation email with tracking soon.
              </p>
              <button 
                onClick={() => setAppStep('landing')}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-colors text-white mt-4"
              >
                Return to Home
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

function RepositoryLink({ href, label }: { href: string, label: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors text-sm text-slate-300"
    >
      {label}
      <ExternalLink className="w-3.5 h-3.5 opacity-50" />
    </a>
  );
}
