import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import CanvasPanel from "@/components/CanvasPanel";

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <CanvasPanel />
      </main>
    </div>
  );
}
