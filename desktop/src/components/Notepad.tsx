export function Notepad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 text-sm font-semibold text-gray-500">Your notes</h2>
      <textarea
        className="flex-1 resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-gray-400"
        placeholder="Jot down anything important as you go — Recall will fill in the rest afterward."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
