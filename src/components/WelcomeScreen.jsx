import Avatar from "./Avatar";

export default function WelcomeScreen({ onBegin }) {
  return (
    <div className="screen centered">
      <div className="content">
        <div className="welcome-avatar" style={{ marginBottom: 8 }}>
          <Avatar mood="idle" height={280} />
        </div>

        <div className="welcome-copy">
          <h1 className="headline">Your career begins now.</h1>
          <p className="subheadline">
            A simulation built on 60 years of career science.
          </p>
          <button className="btn" onClick={onBegin}>
            Begin
          </button>
          <p className="fine-print">
            This will take about 15–20 minutes. There are no right answers.
          </p>
        </div>
      </div>
    </div>
  );
}
