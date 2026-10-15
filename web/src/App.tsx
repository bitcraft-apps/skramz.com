import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { PlayerSlot } from "./PlayerSlot";

const queryClient = new QueryClient();

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
      </Routes>
    </QueryClientProvider>
  );
}
