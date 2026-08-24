import Workspace from "@/components/Workspace";

/* The workspace is the app: no landing page in front of it, because anyone
 * who opens this has a job to price and a splash screen is a click between
 * them and it. The page itself is a server component; only the workspace,
 * which is entirely interactive, is a client one. */

export default function Page() {
  return <Workspace />;
}
