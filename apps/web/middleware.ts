import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  redirectUri: process.env.WORKOS_REDIRECT_URI ?? "http://localhost:3000/auth/callback",
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/login",
      "/auth/login",
      "/auth/callback",
      "/api/me",
      "/idv/:path*",
      "/verify/:path*",
      "/questionnaire/:path*",
      "/api/sumsub",
      "/api/verify",
      "/api/questionnaire",
      "/api/cases/:caseId/actions/mark-idv-done",
      "/api/cases/:caseId/actions/post-idv",
      "/api/cases/:caseId/actions/dispatch-questionnaire",
      "/api/cases/:caseId/actions/record-answers",
      "/api/cases/:caseId",
      "/api/health",
    ],
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
