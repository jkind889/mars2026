import { LoginForm } from "@/components/login-form";
import { Suspense } from "react";

type LoginPageProps = {
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

function safeReturnTo(returnTo?: string) {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return "/protected";
  }

  return returnTo;
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  const { returnTo } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm returnTo={safeReturnTo(returnTo)} />
      </div>
    </div>
  );
}

export default function Page({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={null}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}
