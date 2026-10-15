import { QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { PlayerSlot } from "./PlayerSlot";
import { BandView, MemberView, ReleaseView } from "./encyclopedia";
import { queryClient } from "./queryClient";

function Home() {
  return <main>home</main>;
}

function About() {
  return <main>about</main>;
}

// Root shell: nav + persistent player slot never unmount across routes;
// only the <Routes> outlet swaps.
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <nav>
        <Link to="/">home</Link> <Link to="/about">about</Link>
      </nav>
      <PlayerSlot />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/bands/:id" element={<BandView />} />
        <Route path="/members/:id" element={<MemberView />} />
        <Route path="/releases/:id" element={<ReleaseView />} />
      </Routes>
    </QueryClientProvider>
  );
}
