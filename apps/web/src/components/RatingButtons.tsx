import clsx from 'clsx';

type Props = {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  activeRating?: 1 | 2 | 3 | 4 | null;
};

const buttons = [
  { rating: 1 as const, label: 'Again', key: '1', color: 'bg-red-500 hover:bg-red-600', activeColor: 'bg-red-600 ring-2 ring-red-300' },
  { rating: 2 as const, label: 'Hard', key: '2', color: 'bg-amber-500 hover:bg-amber-600', activeColor: 'bg-amber-600 ring-2 ring-amber-300' },
  { rating: 3 as const, label: 'Good', key: '3', color: 'bg-emerald-500 hover:bg-emerald-600', activeColor: 'bg-emerald-600 ring-2 ring-emerald-300' },
  { rating: 4 as const, label: 'Easy', key: '4', color: 'bg-blue-500 hover:bg-blue-600', activeColor: 'bg-blue-600 ring-2 ring-blue-300' },
];

export function RatingButtons({ onRate, activeRating }: Props) {
  return (
    <div className="flex gap-2 justify-center mt-6">
      {buttons.map(({ rating, label, key, color, activeColor }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          className={clsx(
            'px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors',
            activeRating === rating ? activeColor : color
          )}
        >
          {label} <span className="opacity-60 ml-1">{key}</span>
        </button>
      ))}
    </div>
  );
}
