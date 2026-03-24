import { permanentRedirect } from "next/navigation";

/** Singular URL → canonical `/bin-requests` (avoids wrong/empty page when bookmarked). */
export default function BinRequestRedirectPage() {
  permanentRedirect("/bin-requests");
}
