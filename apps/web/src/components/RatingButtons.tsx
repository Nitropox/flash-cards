import clsx from 'clsx';

type Props = {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
};

const buttons = [
  { rating: 1 as const, label: 'Again', key: '1', color: 'bg-red-500 hover:bg-red-600' },
  { rating: 2 as const, label: 'Hard', key: '2', color: 'bg-amber-500 hover:bg-amber-600' },
  { rating: 3 as const, label: 'Good', key: '3', color: 'bg-emerald-500 hover:bg-emerald-600' },
  { rating: 4 as const, label: 'Easy', key: '4', color: 'bg-blue-500 hover:bg-blue-600' },
];

export function RatingButtons({ onRate }: Props) {
  return (
    <div className="flex gap-2 justify-center mt-6">
      {buttons.map(({ rating, label, key, color }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          className={clsx(
            'px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors',
            color
          )}
        >
          {label} <span className="opacity-60 ml-1">{key}</span>
        </button>
      ))}
    </div>
  );
}
