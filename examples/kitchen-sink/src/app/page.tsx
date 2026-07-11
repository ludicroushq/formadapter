import Link from "next/link";

export default function Home(): React.JSX.Element {
  return (
    <ul>
      <li><Link href="/zod">Zod</Link></li>
      <li><Link href="/arktype">ArkType</Link></li>
      <li><Link href="/html">Native HTML</Link></li>
      <li><Link href="/shadcn">shadcn/ui</Link></li>
      <li><Link href="/arrays-files">Arrays and files</Link></li>
      <li>
        <Link href="/next-server-action">Next.js Server Action wizard</Link>
      </li>
    </ul>
  );
}
