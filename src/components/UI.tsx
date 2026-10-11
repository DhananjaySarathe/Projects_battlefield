import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Command, Leaf, Sparkles, X, Zap } from "lucide-react";
import type { Product } from "../lib/types";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brand-icon">
        <Zap size={21} fill="currentColor" />
      </span>
      {!small && (
        <span>
          battlefield<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: string;
}) {
  return (
    <span
      className={`avatar ${size}`}
      style={{
        background: `hsl(${[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360} 25% 85%)`,
      }}
    >
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function ProductLogo({
  product,
  small = false,
}: {
  product: Product;
  small?: boolean;
}) {
  return (
    <span className={`product-logo ${product.theme} ${small ? "small" : ""}`}>
      {product.logo}
    </span>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        if (!elements.length) {
          e.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", listener);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={`dialog ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Preview({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  if (product.screenshot_url)
    return (
      <div className={`product-preview custom ${large ? "large" : ""}`}>
        <img
          src={product.screenshot_url}
          alt={`${product.name} product screenshot`}
        />
      </div>
    );
  return (
    <div
      className={`product-preview ${product.theme} ${large ? "large" : ""}`}
      aria-label={`${product.name} illustrative preview`}
    >
      <div className="preview-copy">
        <span className="preview-brand">
          {product.logo} {product.name}
        </span>
        <strong>
          {product.id === "demo-1" ? (
            <>
              Less friction.
              <br />
              More connection.
            </>
          ) : product.id === "demo-2" ? (
            <>
              A little space.
              <br />
              For big ideas.
            </>
          ) : product.id === "demo-3" ? (
            <>
              Made for your
              <br />
              next great idea.
            </>
          ) : (
            <>{product.tagline.split(". ")[0]}</>
          )}
        </strong>
        <span className="preview-caption">
          {product.tags.join(" · ")} <ArrowUpRight size={12} />
        </span>
      </div>
      {product.id === "demo-1" ? (
        <div className="mini-form">
          <div className="mini-dots">
            <i />
            <i />
            <i />
          </div>
          <span className="tiny-tag">LET’S GET TO KNOW YOU</span>
          <h4>What brings you here?</h4>
          <span className="mini-option selected">
            <b>A</b> I’m building something new
          </span>
          <span className="mini-option">
            <b>B</b> I’m just exploring
          </span>
          <span className="mini-submit">
            Continue <ArrowUpRight size={10} />
          </span>
          <span className="mini-footer">Made with formly</span>
        </div>
      ) : product.id === "demo-2" ? (
        <div className="mini-workspace">
          <div className="mini-side">
            <span>◒</span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="mini-content">
            <small>YOUR WORKSPACE</small>
            <h4>Good morning, Alex ☀</h4>
            <p>Let’s make something happen.</p>
            <div className="mini-boards">
              <span>
                Ideas <i />
                <i />
                <i />
              </span>
              <span>
                In progress <i />
                <i />
              </span>
              <span>
                Shipped <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        </div>
      ) : product.id === "demo-3" ? (
        <div className="mini-kit">
          {[
            <Command />,
            <Leaf />,
            <Sparkles />,
            <Zap />,
            <ArrowUpRight />,
            <Command />,
            <Sparkles />,
            <Leaf />,
            <Zap />,
          ].map((icon, i) => (
            <span key={i}>{icon}</span>
          ))}
        </div>
      ) : (
        <div className="mini-generic">
          <ProductLogo product={product} />
          <span>Ideas, meet possibility.</span>
          <div className="mini-bars">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </div>
  );
}
export function Empty({
  icon,
  heading,
  body,
  action,
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{heading}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
