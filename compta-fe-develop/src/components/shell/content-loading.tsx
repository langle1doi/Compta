import { ContentLoadingScreen } from "./content-loading-screen";

/** Content-area loading — never remounts the sidebar/header shell. */
export function ContentLoading() {
  return <ContentLoadingScreen />;
}
