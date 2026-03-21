export default function SectionHeader({ title, subtitle, tag }) {
  return (
    <div className="text-center mb-4">
      {tag && <p className="font-mono text-accent-primary text-sm tracking-widest mb-3 uppercase">{tag}</p>}
      <h2 className="font-display font-black text-4xl md:text-5xl text-gradient-cyan mb-4">{title}</h2>
      <div className="section-divider mx-auto" style={{ maxWidth: 320 }} />
      {subtitle && <p className="font-body text-star-blue text-lg mt-4 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  )
}
