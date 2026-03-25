'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ paddingTop: '80px' }}>
			<div className="text-center">
				<h1 className="text-6xl font-bold text-rose-500">Error</h1>
				<h2 className="text-2xl font-semibold mt-4 mb-2">Something went wrong</h2>
				<p className="text-zinc-400 mb-8 max-w-md mx-auto">
					An unexpected error occurred. Please try again or contact support if the problem persists.
				</p>
				<div className="flex gap-4 justify-center">
					<button
						onClick={reset}
						className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
					>
						Try Again
					</button>
					<Link
						href="/"
						className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
					>
						Go Home
					</Link>
				</div>
			</div>
		</div>
	);
}
