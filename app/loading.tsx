export default function Loading() {
	return (
		<div className="min-h-screen flex items-center justify-center" style={{ paddingTop: '80px' }}>
			<div className="flex flex-col items-center gap-4">
				<div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
				<p className="text-zinc-400">Loading...</p>
			</div>
		</div>
	);
}
