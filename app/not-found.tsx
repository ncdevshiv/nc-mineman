import Link from 'next/link';

export default function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ paddingTop: '80px' }}>
			<div className="text-center">
				<h1 className="text-9xl font-bold text-zinc-800">404</h1>
				<h2 className="text-3xl font-semibold mt-4 mb-2">Page Not Found</h2>
				<p className="text-zinc-400 mb-8">
					Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved.
				</p>
				<Link
					href="/"
					className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
				>
					Go Home
				</Link>
			</div>
		</div>
	);
}
