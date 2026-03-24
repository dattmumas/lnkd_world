import Nav from "@/components/nav";
import Hero from "@/components/hero";
import NowSection from "@/components/now-section";
import WritingSection from "@/components/writing-section";
import ReadingSection from "@/components/reading-section";
import BookmarksSection from "@/components/bookmarks-section";
import ProjectList from "@/components/project-list";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <Hero />
        <NowSection />
        <WritingSection />
        <ReadingSection />
        <BookmarksSection />
        <ProjectList />
      </main>
      <Footer />
    </div>
  );
}
