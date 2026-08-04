import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terra — Land Developer Platform" },
      {
        name: "description",
        content: "Premium plotted developments, managed end to end. Discover Terra's current projects or sign in to your dashboard.",
      },
    ],
  }),
  component: Index,
});

const ASSET = "https://storage.googleapis.com/webild/default/templates/marbella";

const villas = [
  { name: "Villa Serena", img: `${ASSET}/properties/villa-1.webp`, desc: "A sunlit 5-bedroom retreat with infinity pool, panoramic sea views, and private garden terraces." },
  { name: "Casa del Sol", img: `${ASSET}/properties/villa-2.webp`, desc: "Contemporary beachfront living with floor-to-ceiling glass, rooftop lounge, and direct beach access." },
  { name: "Villa Andalucía", img: `${ASSET}/properties/villa-3.webp`, desc: "Traditional charm meets modern luxury — courtyard, olive grove, and a heated outdoor pool." },
  { name: "The Meridian", img: `${ASSET}/properties/villa-4.webp`, desc: "Sleek 4-bedroom penthouse villa with smart home technology and sweeping coastal views." },
  { name: "Villa Blanca", img: `${ASSET}/properties/villa-5.webp`, desc: "Minimalist white-washed estate with private cinema, spa suite, and landscaped Mediterranean gardens." },
  { name: "Casa Dorada", img: `${ASSET}/properties/villa-6.webp`, desc: "Golden-hour perfection — west-facing terraces, wine cellar, and an open-plan chef's kitchen." },
];

const footerCols = [
  { title: "Properties", items: ["Villas", "Apartments", "Penthouses", "New Developments"] },
  { title: "Services", items: ["Property Search", "Legal Assistance", "Interior Design", "Property Management"] },
  { title: "Locations", items: ["Golden Mile", "Puerto Banús", "Sierra Blanca", "La Zagaleta"] },
  { title: "Company", items: ["About Us", "Contact", "Privacy Policy", "Terms of Service"] },
];

function FadeIn({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (domRef.current) observer.unobserve(domRef.current);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    const current = domRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  const translateClasses = {
    up: "translate-y-8",
    down: "-translate-y-8",
    left: "translate-x-8",
    right: "-translate-x-8",
    none: "",
  };

  return (
    <div
      ref={domRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${isVisible
        ? "opacity-100 translate-x-0 translate-y-0"
        : `opacity-0 ${translateClasses[direction]}`
        } ${className}`}
    >
      {children}
    </div>
  );
}

function ParallaxLayer({
  children,
  speed = 0.2,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!layerRef.current) return;
      const rect = layerRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const distFromCenter = rect.top + rect.height / 2 - windowH / 2;
      setTranslateY(distFromCenter * speed);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div
      ref={layerRef}
      className={`will-change-transform transition-transform duration-150 ease-out ${className}`}
      style={{
        transform: `translate3d(0, ${translateY.toFixed(1)}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

function ParallaxClipReveal({
  src,
  alt,
  className = "",
  aspectRatio = "aspect-video",
}: {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const rawProgress = (windowH - rect.top) / (windowH + rect.height * 0.4);
      const clamped = Math.min(1, Math.max(0, rawProgress));
      const eased = 1 - Math.pow(1 - clamped, 3);
      setProgress(eased);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const insetY = ((1 - progress) * 3.5).toFixed(2);
  const insetX = ((1 - progress) * 4.5).toFixed(2);
  const scale = (1 + (1 - progress) * 0.06).toFixed(3);

  return (
    <div
      ref={containerRef}
      className={`group overflow-hidden rounded-xl border border-foreground/10 relative shadow-2xl transition-[clip-path] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${aspectRatio} ${className}`}
      style={{
        clipPath: `inset(${insetY}% ${insetX}% round 12px)`,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
        style={{
          transform: `scale(${scale})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}

function ParallaxContactSection({
  handleContactSubmit,
  contactName,
  setContactName,
  contactEmail,
  setContactEmail,
  contactPhone,
  setContactPhone,
  contactMessage,
  setContactMessage,
  contactLoading,
}: {
  handleContactSubmit: (e: React.FormEvent) => Promise<void>;
  contactName: string;
  setContactName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  contactMessage: string;
  setContactMessage: (v: string) => void;
  contactLoading: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [bgOffset, setBgOffset] = useState(0);
  const [clipProgress, setClipProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;

      const rawProgress = (windowH - rect.top) / (windowH + rect.height);
      const clamped = Math.min(1, Math.max(0, rawProgress));

      const offset = (clamped - 0.5) * -16;
      setBgOffset(offset);

      const clipRaw = (windowH - rect.top) / (windowH * 0.7);
      const clipClamped = Math.min(1, Math.max(0, clipRaw));
      const easedClip = 1 - Math.pow(1 - clipClamped, 3);
      setClipProgress(easedClip);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const insetY = ((1 - clipProgress) * 3).toFixed(2);
  const insetX = ((1 - clipProgress) * 4).toFixed(2);

  return (
    <section
      id="contact"
      ref={sectionRef}
      aria-label="Contact"
      className="relative overflow-hidden min-h-[85vh] md:min-h-[95vh] my-16 md:my-28 py-12 md:py-16 flex items-center justify-center transition-[clip-path] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        clipPath: `inset(${insetY}% ${insetX}% round 16px)`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          alt="Villa at dusk"
          className="absolute inset-x-0 -top-[15%] w-full h-[130%] object-cover will-change-transform transition-transform duration-300 ease-out"
          style={{
            transform: `translateY(${bgOffset.toFixed(2)}%) scale(1.05)`,
          }}
          src={`${ASSET}/contact/cta-bg.webp`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      </div>

      <div className="relative z-10 flex items-center justify-center w-full px-6 md:px-12 py-8 md:py-12">
        <div className="mx-auto w-content-width">
          <FadeIn direction="up">
            <div className="w-full md:w-1/2 lg:w-5/12 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 md:p-10 shadow-2xl transition-all duration-500 hover:border-white/30 hover:bg-white/[0.13]">
              <div className="w-fit px-3 py-1 mb-2.5 text-[11px] sm:text-xs tracking-[0.15em] uppercase bg-white/15 text-white/90 rounded-full font-medium border border-white/10">
                Private Inquiries
              </div>
              <h2 className="mb-4 sm:mb-6 text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight">
                Get In Touch
              </h2>
              <form className="flex flex-col gap-3.5 sm:gap-4" onSubmit={handleContactSubmit}>
                <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2">
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder="Your name"
                    aria-label="Your name"
                    type="text"
                    className="w-full h-11 sm:h-13 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-5 text-sm sm:text-base text-white placeholder:text-white/40 focus:border-terracotta/80 focus:bg-white/15 focus:outline-none transition-all duration-300"
                  />
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder="Your email"
                    aria-label="Your email"
                    type="email"
                    className="w-full h-11 sm:h-13 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-5 text-sm sm:text-base text-white placeholder:text-white/40 focus:border-terracotta/80 focus:bg-white/15 focus:outline-none transition-all duration-300"
                  />
                </div>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                  placeholder="Your phone number"
                  aria-label="Your phone number"
                  type="tel"
                  className="w-full h-11 sm:h-13 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-5 text-sm sm:text-base text-white placeholder:text-white/40 focus:border-terracotta/80 focus:bg-white/15 focus:outline-none transition-all duration-300"
                />
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                  rows={3}
                  placeholder="Tell us about your dream property..."
                  aria-label="Message"
                  className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-4 sm:px-5 py-3 text-sm sm:text-base text-white placeholder:text-white/40 focus:border-terracotta/80 focus:bg-white/15 focus:outline-none transition-all duration-300"
                />
                <button
                  type="submit"
                  disabled={contactLoading}
                  className="flex items-center justify-center w-full h-11 sm:h-13 px-6 text-sm sm:text-base font-medium rounded-xl bg-white text-black cursor-pointer transition-all duration-300 hover:bg-white/90 hover:shadow-lg disabled:opacity-50"
                >
                  {contactLoading ? "Sending..." : "Send Message"}
                </button>
              </form>
              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/15 pt-5 sm:pt-6">
                <p className="text-xs sm:text-sm text-white/80">Prefer to talk? Book a private tour.</p>
                <a
                  href="mailto:hello@terra.dev"
                  className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md p-1.5 pr-4 sm:pr-5 text-xs sm:text-sm font-medium text-white whitespace-nowrap transition-all duration-300 hover:bg-white/25 border border-white/10"
                >
                  <img alt="Advisor" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover" src={`${ASSET}/contact/avatar.webp`} />
                  Email Us
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function CanvasHeroVideo({
  heroWrapRef,
}: {
  heroWrapRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [, setIsLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    const totalFrames = 300;
    const loadedImages: HTMLImageElement[] = new Array(totalFrames);
    let loadedCount = 0;

    // Load first frame immediately for instant display
    const img1 = new Image();
    img1.src = `/hero/ezgif-frame-001.jpg`;
    img1.onload = () => {
      if (canceled) return;
      loadedImages[0] = img1;
      imagesRef.current = loadedImages;
      setIsLoaded(true);
    };

    // Preload remaining frames
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, "0");
      img.src = `/hero/ezgif-frame-${frameNum}.jpg`;
      img.onload = () => {
        if (canceled) return;
        loadedImages[i - 1] = img;
        loadedCount++;
        if (loadedCount % 10 === 0) {
          imagesRef.current = [...loadedImages];
        }
      };
    }

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = heroWrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const render = () => {
      const rect = wrap.getBoundingClientRect();
      const total = wrap.offsetHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const imgs = imagesRef.current;
      const totalFrames = 300;
      const frameIndex = Math.min(
        totalFrames - 1,
        Math.max(0, Math.floor(progress * totalFrames))
      );

      // Find nearest loaded frame if current frame is downloading
      let img = imgs[frameIndex];
      if (!img || !img.complete || img.naturalWidth === 0) {
        for (let offset = 1; offset < 30; offset++) {
          const prev = imgs[Math.max(0, frameIndex - offset)];
          if (prev && prev.complete && prev.naturalWidth > 0) {
            img = prev;
            break;
          }
          const next = imgs[Math.min(totalFrames - 1, frameIndex + offset)];
          if (next && next.complete && next.naturalWidth > 0) {
            img = next;
            break;
          }
        }
      }

      if (img && img.complete && img.naturalWidth > 0) {
        const hRatio = canvas.width / img.naturalWidth;
        const vRatio = canvas.height / img.naturalHeight;
        const ratio = Math.max(hRatio, vRatio);
        const centerShiftX = (canvas.width - img.naturalWidth * ratio) / 2;
        const centerShiftY = (canvas.height - img.naturalHeight * ratio) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
          centerShiftX,
          centerShiftY,
          img.naturalWidth * ratio,
          img.naturalHeight * ratio
        );
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [heroWrapRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

const heroChapters = [
  {
    badge: "Terra Premium Land Developments",
    title: "Discover Plots with a Soul",
    subtitle: "Sanctuaries designed for modern living & everlasting peace.",
    buttons: [
      { text: "View Properties", href: "#properties", primary: true },
      { text: "Book a Tour", href: "#contact", primary: false },
    ],
  },
  {
    badge: "Master-Planned Excellence",
    title: "Prime Locations, Pure Nature",
    subtitle: "Seamlessly integrated infrastructure with panoramic aerial vistas.",
    buttons: [
      { text: "Explore Layouts", href: "#properties", primary: true },
      { text: "Our Vision", href: "#about", primary: false },
    ],
  },
  {
    badge: "Your Future Heritage",
    title: "Build Your Signature Vision",
    subtitle: "Exclusive plotted parcels ready for custom luxury construction.",
    buttons: [
      { text: "Book a Private Tour", href: "#contact", primary: true },
      { text: "Sign In", href: "/auth", primary: false },
    ],
  },
];

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const heroWrapRef = useRef<HTMLDivElement>(null);
  const [scrollLen] = useState(3000);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const wrap = heroWrapRef.current;
    if (!wrap) return;

    const handleScroll = () => {
      const rect = wrap.getBoundingClientRect();
      const total = wrap.offsetHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactPhone || !contactMessage) {
      toast.error("Please fill in all fields");
      return;
    }
    setContactLoading(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        message: contactMessage,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error("A message has already been sent with this phone number.");
        } else {
          toast.error("Failed to send message. Please try again.");
        }
        throw error;
      }

      toast.success("Message sent successfully!");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactMessage("");
    } catch (err) {
      console.error(err);
    } finally {
      setContactLoading(false);
    }
  };

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["landing-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, location, description, cover_image_url, status, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="relative bg-background text-foreground">
      {/* NAV */}
      <nav className="fixed inset-x-0 top-0 z-[1000] bg-black/30 backdrop-blur-md border-b border-white/10 py-4">
        <div className="w-content-width mx-auto flex items-center justify-between relative z-[1100]">
          <Link to="/" className="text-xl font-medium text-white mix-blend-difference">Terra</Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/auth"
              className="flex items-center gap-1.5 h-9 px-3 sm:px-5 text-xs sm:text-sm rounded secondary-button hover:opacity-90 whitespace-nowrap"
            >
              <LogIn className="size-3.5 sm:size-4 shrink-0" />
              Log In
            </Link>
            <a href="#contact" className="flex items-center justify-center h-9 px-3 sm:px-5 text-xs sm:text-sm rounded primary-button hover:opacity-90 whitespace-nowrap">Book a Tour</a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="group relative flex flex-col justify-center items-center w-9 h-9 gap-1 z-[1100] text-white hover:opacity-80 transition-opacity"
              aria-label="Toggle menu"
            >
              <span className={`w-5 h-0.5 bg-current transition-transform duration-300 ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`w-5 h-0.5 bg-current transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`w-5 h-0.5 bg-current transition-transform duration-300 ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </button>
          </div>
        </div>
        <div
          className={`fixed inset-0 h-screen w-screen flex flex-col items-center justify-center bg-foreground transition-all duration-700 ease-[cubic-bezier(0.9,0,0.1,1)] ${menuOpen ? "pointer-events-auto opacity-100 z-[1050]" : "pointer-events-none opacity-0 z-[-1]"
            }`}
          style={{ clipPath: menuOpen ? "polygon(0 0,100% 0,100% 100%,0 100%)" : "polygon(0 0,100% 0,100% 0,0 0)" }}
        >
          <div className="flex flex-col items-center w-full max-w-3xl px-6 sm:px-8">
            <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
              <a
                href="#hero"
                onClick={() => setMenuOpen(false)}
                className="text-3xl sm:text-5xl font-medium text-background hover:opacity-75 transition-opacity"
              >
                Home
              </a>
              <a
                href="#properties"
                onClick={() => setMenuOpen(false)}
                className="text-3xl sm:text-5xl font-medium text-background hover:opacity-75 transition-opacity"
              >
                Properties
              </a>
              <a
                href="#about"
                onClick={() => setMenuOpen(false)}
                className="text-3xl sm:text-5xl font-medium text-background hover:opacity-75 transition-opacity"
              >
                About
              </a>
              <a
                href="#contact"
                onClick={() => setMenuOpen(false)}
                className="text-3xl sm:text-5xl font-medium text-background hover:opacity-75 transition-opacity"
              >
                Contact
              </a>
            </div>
            <div className="w-full mt-12 pt-8 border-t border-background/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-background/60">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="hover:opacity-100 transition-opacity"
              >
                <div
                  className="font-medium text-background tracking-tighter uppercase"
                  style={{ fontSize: "clamp(2rem,6vw,8rem)" }}
                />
              </Link>
              <div className="h-px bg-background/20" />
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* HERO — scroll-scrubbed video canvas */}
        <div id="hero" ref={heroWrapRef} className="relative bg-black" style={{ height: `${scrollLen}px` }}>
          <section className="sticky top-0 overflow-hidden flex flex-col justify-between w-full h-screen bg-black">
            <CanvasHeroVideo heroWrapRef={heroWrapRef} />

            {/* Soft subtle top & bottom gradient for nav & footer legibility */}
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" aria-hidden />

            <div className="relative z-10 w-content-width mx-auto pt-24 sm:pt-28 flex-1 flex flex-col justify-center">
              <div className="relative w-full md:w-7/10 lg:w-6/10 xl:w-[54%] 2xl:w-4/10 min-h-[320px]">
                {heroChapters.map((chapter, idx) => {
                  const start = idx / heroChapters.length;
                  const end = (idx + 1) / heroChapters.length;
                  const mid = (start + end) / 2;

                  let opacity = 0;
                  if (idx === 0 && scrollProgress < 0.28) {
                    opacity = 1 - Math.max(0, (scrollProgress - 0.18) / 0.10);
                  } else if (idx === heroChapters.length - 1 && scrollProgress > 0.65) {
                    opacity = Math.min(1, (scrollProgress - 0.65) / 0.12);
                  } else {
                    const dist = Math.abs(scrollProgress - mid);
                    const maxDist = 0.18;
                    opacity = Math.max(0, 1 - dist / maxDist);
                  }

                  const active = opacity > 0.05;

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-3 transition-all duration-500 ease-out ${
                        active ? "pointer-events-auto" : "pointer-events-none"
                      } ${idx === 0 ? "relative" : "absolute inset-0"}`}
                      style={{
                        opacity,
                        transform: `translateY(${(1 - opacity) * 16}px)`,
                      }}
                    >
                      <div className="w-fit px-3 py-1 mb-1 text-xs sm:text-sm bg-card/90 text-card-foreground rounded shadow-sm">
                        {chapter.badge}
                      </div>
                      <h1 className="text-4xl sm:text-6xl md:text-7xl 2xl:text-8xl leading-[1.15] font-semibold text-white text-balance drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
                        {chapter.title}
                      </h1>
                      <p className="text-lg md:text-xl text-white leading-snug text-balance drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                        {chapter.subtitle}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 md:mt-3">
                        {chapter.buttons.map((btn) => (
                          <a
                            key={btn.text}
                            href={btn.href}
                            className={`flex items-center justify-center h-10 px-6 text-sm rounded ${
                              btn.primary ? "primary-button" : "secondary-button"
                            } hover:opacity-90`}
                          >
                            {btn.text}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative z-10 flex justify-end items-end mx-auto pb-8 w-content-width">
              <p className="md:max-w-1/2 2xl:max-w-4/10 text-xs md:text-sm uppercase tracking-wide leading-relaxed text-balance text-end text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                An independent land development studio crafting untamed, soulful spaces for those seeking a different rhythm. A product by HAEGL technologies.
              </p>
            </div>
          </section>
        </div>

        {/* ABOUT */}
        <section id="about" aria-label="About" className="relative py-28 overflow-hidden">
          <ParallaxLayer speed={-0.18} className="absolute inset-x-0 top-6 flex justify-center pointer-events-none select-none z-0">
            <span className="text-[8.7vw] font-black text-foreground/[0.08] uppercase tracking-tight whitespace-nowrap w-full text-center px-1">
              TERRA ESTATES
            </span>
          </ParallaxLayer>
          <div className="relative z-10 flex flex-col gap-8 md:gap-10 mx-auto w-content-width">
            <FadeIn direction="up">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-terracotta mb-1">
                  01 — Terra Vision
                </span>
                <h2 className="md:max-w-8/10 text-5xl md:text-7xl 2xl:text-8xl leading-[1.15] font-semibold text-center text-balance">
                  For those who travel like it's an art form.
                </h2>
              </div>
            </FadeIn>
            <FadeIn direction="up" delay={150}>
              <ParallaxClipReveal
                src={`${ASSET}/about/statement.webp`}
                alt="Modern villa exterior"
                aspectRatio="aspect-square md:aspect-video"
              />
            </FadeIn>
          </div>
        </section>

        {/* PROJECTS */}
        <section id="properties" aria-label="Projects" className="relative py-28 overflow-hidden">
          <ParallaxLayer speed={-0.2} className="absolute inset-x-0 top-8 flex justify-center pointer-events-none select-none z-0">
            <span className="text-[8.7vw] font-black text-foreground/[0.08] uppercase tracking-tight whitespace-nowrap w-full text-center px-1">
              PLOTTED PARCELS
            </span>
          </ParallaxLayer>
          <div className="relative z-10 flex flex-col gap-8 md:gap-10">
            <FadeIn direction="up">
              <div className="flex flex-col items-center w-content-width mx-auto gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-terracotta mb-1">
                  02 — Terra Developments
                </span>
                {/* <div className="px-3 py-1 mb-1 text-sm bg-card/90 text-card-foreground rounded w-fit">Developments</div> */}
                <h2 className="md:max-w-8/10 text-5xl md:text-6xl 2xl:text-7xl leading-[1.15] font-semibold text-center text-balance">
                  Our Projects
                </h2>
                <p className="md:max-w-7/10 text-lg md:text-xl leading-snug text-center text-balance text-muted-foreground">
                  Explore the plotted developments currently available through Terra.
                </p>
              </div>
            </FadeIn>
            <div className="w-content-width mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
              {projectsLoading ? (
                <p className="col-span-full py-12 text-center text-muted-foreground">Loading projects…</p>
              ) : projects.length === 0 ? (
                <p className="col-span-full py-12 text-center text-muted-foreground">New project launches will appear here soon.</p>
              ) : (
                projects.map((project, index) => (
                  <FadeIn key={project.id} direction="up" delay={index * 150}>
                    <div className="flex flex-col gap-3 xl:gap-3.5 2xl:gap-4">
                      <ParallaxClipReveal
                        src={project.cover_image_url || `${ASSET}/properties/villa-${(index % 6) + 1}.webp`}
                        alt={project.name}
                        aspectRatio="aspect-square"
                      />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-3"><h3 className="text-3xl font-semibold leading-snug">{project.name}</h3><span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">{project.status}</span></div>
                        <p className="text-sm font-medium text-terracotta">{project.location}</p>
                        <p className="text-base leading-snug text-muted-foreground">{project.description || "A thoughtfully planned Terra land development."}</p>
                        <Link to="/auth" className="mt-2 w-fit text-sm font-medium underline underline-offset-4 hover:text-terracotta">Explore project</Link>
                      </div>
                    </div>
                  </FadeIn>
                ))
              )}
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <ParallaxContactSection
          handleContactSubmit={handleContactSubmit}
          contactName={contactName}
          setContactName={setContactName}
          contactEmail={contactEmail}
          setContactEmail={setContactEmail}
          contactPhone={contactPhone}
          setContactPhone={setContactPhone}
          contactMessage={contactMessage}
          setContactMessage={setContactMessage}
          contactLoading={contactLoading}
        />
      </main>

      <footer aria-label="Site footer" className="w-full pt-20 pb-10">
        <FadeIn direction="up">
          <div className="w-content-width mx-auto pt-10 border-t border-foreground/15">
            <div className="w-full flex flex-wrap justify-between gap-y-10 mb-10">
              {footerCols.map((col) => (
                <div key={col.title} className="w-1/2 md:w-auto flex flex-col items-start gap-3">
                  <h3 className="text-sm opacity-50 truncate">{col.title}</h3>
                  {col.items.map((it) => (
                    <button key={it} className="text-base hover:opacity-75 transition-opacity cursor-pointer text-left">
                      {it}
                    </button>
                  ))}
                </div>
              ))}
              <div className="w-1/2 md:w-auto flex flex-col items-start gap-3">
                <h3 className="text-sm opacity-50 truncate">Account</h3>
                <Link to="/auth" className="text-base hover:opacity-75 transition-opacity cursor-pointer text-left">
                  Log In
                </Link>
              </div>
            </div>
            <div className="w-full h-px bg-foreground/20" />
            <div className="w-full flex items-center justify-between pt-5">
              <span className="text-sm opacity-50">© 2026 Terra Studios. All rights reserved.</span>
              <span className="text-sm opacity-50">Marbella, Costa del Sol</span>
            </div>
          </div>
        </FadeIn>
      </footer>
    </div>
  );
}
