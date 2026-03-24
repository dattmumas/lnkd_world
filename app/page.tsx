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

        {/* Two-column layout: content left, sidebar right on wide desktop */}
        <div className="xl:grid xl:grid-cols-[1fr_240px] xl:gap-16">
          <div className="min-w-0">
            <WritingSection />
            <ReadingSection />
            <BookmarksSection />
            <ProjectList />
          </div>

          {/* Sidebar: below content on mobile/tablet, right column on xl+ */}
          <div className="mt-16 xl:mt-0 xl:border-l xl:border-[var(--color-border)] xl:pl-10">
            <div className="xl:sticky xl:top-8">
              <Sidebar />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
