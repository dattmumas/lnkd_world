import Nav from "@/components/nav";
import Hero from "@/components/hero";
import NowSection from "@/components/now-section";
import WritingSection from "@/components/writing-section";
import ReadingSection from "@/components/reading-section";
import BookmarksSection from "@/components/bookmarks-section";
import ProjectList from "@/components/project-list";
import Sidebar from "@/components/sidebar";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-12 md:py-16">
        <Hero />
        <NowSection />

        {/* Two-column layout: content left, stats right on desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-12 mt-8">
          <div>
            <WritingSection />
            <ReadingSection />
            <BookmarksSection />
            <ProjectList />
          </div>

          {/* Sidebar: below content on mobile, right column on desktop */}
          <div className="mt-12 lg:mt-0 lg:sticky lg:top-8 lg:self-start">
            <Sidebar />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
