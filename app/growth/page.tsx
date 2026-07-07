import { redirect } from "next/navigation";

/** /growth is the short path to the growth dashboard (hash tabs survive the
 * redirect client-side, e.g. /growth#deals → /admin/growth#deals). */
export default function GrowthRedirect() {
  redirect("/admin/growth");
}
