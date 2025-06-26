import { RedirectToSignIn } from "@clerk/react-router";

export default function Logout() {
  return <RedirectToSignIn redirectUrl={"/choose-org"} />;
}
