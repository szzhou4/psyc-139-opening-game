export default function OutcomeCard({ text, loading }) {
  return (
    <div className="outcome-card">
      <div className="eyebrow">At sixty-five</div>
      {loading ? (
        <p style={{ opacity: 0.55 }}>Looking back…</p>
      ) : (
        <p>{text.replace(/^["“]|["”]$/g, "")}</p>
      )}
    </div>
  );
}
