import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
    debug: true, // Enable debug logs
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            // Pass the access token to the client if needed, or just use basic profile info
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
});

// Debug log to confirm env vars are loaded (will show in terminal)
console.log("NextAuth Config:", {
    clientIdLoaded: !!process.env.GOOGLE_CLIENT_ID,
    clientSecretLoaded: !!process.env.GOOGLE_CLIENT_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL,
});

export { handler as GET, handler as POST };
