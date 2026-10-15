// Persistent player slot. Lives in the root App component, outside
// <Routes>, so client-side navigation never unmounts it (audio keeps
// playing uninterrupted across routes). Deliberately stateless: no hooks,
// no mount counting — persistence is structural, not measured.
export function PlayerSlot() {
  return (
    <div data-testid="player-slot" className="zine-border">
      <audio data-testid="player-audio" controls={false} />
    </div>
  );
}
