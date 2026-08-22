import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = "/cambiar-password";
  const supabase = await createClient();

  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("SUPABASE recovery code ERROR:", {
        code: error.code,
        message: error.message,
      });
    }
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      console.error("SUPABASE recovery otp ERROR:", {
        code: error.code,
        message: error.message,
      });
    }
    verified = !error;
  }

  if (verified) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(
    new URL("/recuperar-password?error=enlace-invalido", url.origin),
  );
}
