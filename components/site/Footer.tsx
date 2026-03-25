import Link from 'next/link';
import siteConfig from '@/lib/site.config';

export function Footer() {
  return (
    <footer className="py-12 border-t border-white/5 mt-16 relative z-10 bg-[#080d0a]/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">

      <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity cursor-default">
        <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <span className="font-black text-emerald-400">{siteConfig.brand.logo.letter}</span>
        </div>
        <span className="text-sm font-black tracking-widest text-slate-300">{siteConfig.name.full.toUpperCase()} &copy; {new Date().getFullYear()}</span>
      </div>

      <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-slate-500 text-sm font-medium">
        <Link href="/rules" className="hover:text-emerald-400 transition-colors px-2 py-1">Server Rules</Link>
        <Link href="/wiki" className="hover:text-emerald-400 transition-colors px-2 py-1">Documentation</Link>
        <Link href="/contact" className="hover:text-emerald-400 transition-colors px-2 py-1">Support</Link>
      </div>

      <div className="flex gap-6 mt-4 md:mt-0">
        <a href={siteConfig.social.youtube} target="_blank" rel="noopener noreferrer" className="size-12 rounded-xl glass-effect flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all">
          <span className="font-bold">YT</span>
        </a>
        <a href={siteConfig.social.discord} target="_blank" rel="noopener noreferrer" className="size-12 rounded-xl glass-effect flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all">
          <span className="font-bold">DC</span>
        </a>
      </div>

      </div>
    </footer>
  );
}
