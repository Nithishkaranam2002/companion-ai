import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, Prose } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What CompanionAI collects, how it is protected, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        intro="Plain-language details on what we collect, why, and how we protect it. Last updated October 17, 2026."
      />
      <Prose>
        <h2>The short version</h2>
        <ul>
          <li>Personal details like names, emails and phone numbers in your messages are removed before your messages are stored.</li>
          <li>We never write your message text to our server logs.</li>
          <li>We don&apos;t sell your data or use it for advertising.</li>
          <li>You can delete any conversation at any time from the chat sidebar.</li>
        </ul>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account information:</strong> your email address, or your Google account email and name if you sign in with Google. Demo sessions are anonymous and have no email.</li>
          <li><strong>Conversations:</strong> your messages and CompanionAI&apos;s replies, stored after personal details are redacted, along with the sources cited.</li>
          <li><strong>Mood check-ins:</strong> the score you choose and an optional note (also redacted).</li>
          <li><strong>Safety tickets:</strong> if a message shows signs of crisis or emergency, or you ask for a person, we store a redacted copy of that message and the reason, so a member of our team can follow up.</li>
          <li><strong>Usage counts:</strong> timestamps of messages sent, used only to apply message limits.</li>
          <li><strong>Contact form:</strong> the name, email and message you submit.</li>
        </ul>

        <h2>How we use it</h2>
        <p>
          We use your information to provide the service: to reply to you, keep your history, show your mood chart, apply
          fair-use limits, follow up on safety tickets, and answer messages you send us. We don&apos;t use your conversations
          to build advertising profiles.
        </p>

        <h2>Who processes your data</h2>
        <p>We rely on a small number of service providers, each bound by their own data protection terms:</p>
        <ul>
          <li><strong>Supabase:</strong> database and sign-in. Data is encrypted in transit and at rest.</li>
          <li><strong>OpenAI:</strong> generates replies and safety checks from your <em>redacted</em> messages. Data sent through the OpenAI API is not used to train their models by default.</li>
          <li><strong>Vercel</strong> (website) and <strong>Render</strong> (application server): hosting.</li>
          <li><strong>Google:</strong> only if you choose &ldquo;Continue with Google&rdquo;.</li>
        </ul>

        <h2>Cookies and local storage</h2>
        <p>
          We use essential cookies to keep you signed in, and your browser&apos;s local storage to remember your light or dark
          theme choice. We don&apos;t use advertising or third-party tracking cookies.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Conversations and mood entries are kept until you delete them or close your account. Usage counts are kept only
          as long as they&apos;re needed for message limits. Safety tickets are kept for our records after they&apos;re resolved.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Delete individual conversations in the chat sidebar.</li>
          <li>Request a copy of your data, or deletion of your account and all associated data, through our <Link href="/contact?topic=privacy">contact form</Link>.</li>
        </ul>

        <h2>Health information</h2>
        <p>
          CompanionAI is a wellness service, not a healthcare provider. It isn&apos;t covered by HIPAA. Please avoid sharing
          information you wouldn&apos;t want stored, even in redacted form.
        </p>

        <h2>Children</h2>
        <p>CompanionAI is intended for adults aged 18 and over. We don&apos;t knowingly collect data from children.</p>

        <h2>Changes and contact</h2>
        <p>
          If we make material changes to this policy, we&apos;ll update the date above and let signed-in users know. Questions?{" "}
          <Link href="/contact?topic=privacy">Contact us</Link>.
        </p>
      </Prose>
    </>
  );
}
