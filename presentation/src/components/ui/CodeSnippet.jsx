export default function CodeSnippet({ code, className = '' }) {
  return (
    <pre className={`font-mono text-xs md:text-sm bg-black/60 border border-accent-primary/20 rounded-xl p-4 overflow-x-auto leading-relaxed ${className}`}>
      <code className="text-accent-primary">{code}</code>
    </pre>
  )
}
