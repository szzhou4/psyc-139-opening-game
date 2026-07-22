export default function NarrativePanel({ narrative, loading }) {
  return (
    <div className="narrative-panel">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>
        Your career, ages 22–65
      </div>
      <h2>The path you built</h2>

      {loading ? (
        <>
          {["100%", "96%", "99%", "88%", "100%", "94%", "70%"].map((w, i) => (
            <div
              key={i}
              className="skeleton-line"
              style={{
                width: w,
                animationDelay: `${i * 120}ms`,
                background:
                  "linear-gradient(90deg, rgba(247,244,239,0.06) 0%, rgba(247,244,239,0.14) 50%, rgba(247,244,239,0.06) 100%)",
                backgroundSize: "200% 100%",
              }}
            />
          ))}
          <p
            className="fine-print"
            style={{ marginTop: 14, fontStyle: "italic" }}
          >
            Writing your career narrative…
          </p>
        </>
      ) : (
        narrative
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((para, i) => <p key={i}>{para.trim()}</p>)
      )}
    </div>
  );
}
