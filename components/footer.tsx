export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-6 mt-auto">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Copyright &copy; Matthew Dumas {new Date().getFullYear()}
      </p>
    </footer>
  );
}
