import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import OutputPanel from "@/components/OutputPanel";
import { OutputProvider } from "@/context/OutputContext";

export default function Home() {
  return (
    <OutputProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 flex overflow-hidden">
          <ChatPanel />
          <OutputPanel />
        </main>
      </div>
    </OutputProvider>
  );
}
