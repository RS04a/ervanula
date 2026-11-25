const images = {
  horizontal: ["arveluna-horizontal.png", 2152, 731, "ARVELUNA"],
  symbol: ["arveluna-symbol.png", 1254, 1254, "ARVELUNA"],
  arve: ["arvecoins-token.png", 1254, 1254, "ArveCoins (ARVE)"],
};

export function BrandImage({ variant, decorative = false }) {
  const [file, width, height, label] = images[variant];

  return (
    <img
      className={`brand-image brand-image--${variant}`}
      src={`/brand/${file}`}
      width={width}
      height={height}
      alt={decorative ? "" : label}
    />
  );
}
