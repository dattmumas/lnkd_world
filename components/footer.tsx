export default function Footer() {
  return (
    <footer className="border-t-2 border-[var(--color-border)] py-8 mt-auto text-center">
      <p className="ol-mono text-base font-bold text-[var(--color-text)] leading-none select-none" aria-hidden>
        ▌│▐▌│▌██▏▌▐▏█▌▏▐██▏▌▏▐█▌▏█▐▏▌█
      </p>
      <p className="ol-mono text-[10px] text-[var(--color-text-secondary)] mt-2 tracking-widest uppercase">
        LNKD · Seattle WA · © {new Date().getFullYear()} Matthew Dumas
      </p>
    </footer>
  );
}
