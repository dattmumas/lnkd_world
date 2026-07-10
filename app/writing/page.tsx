import { redirect } from "next/navigation";

// The essays index lives at /notes now; individual posts stay at /writing/[slug].
export default function WritingIndexRedirect() {
  redirect("/notes");
}
