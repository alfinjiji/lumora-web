import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { formatPrice } from '../products'

type PaymentResult = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}
type StoreConfig = {
  checkoutReady: boolean
  shippingPaise: number
  keyId: string | null
}
type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string; contact: string }
  theme: { color: string }
  handler: (result: PaymentResult) => void
  modal: { ondismiss: () => void }
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open(): void
      on(
        name: string,
        callback: (response: { error: { description?: string } }) => void,
      ): void
    }
  }
}
let sdkPromise: Promise<void> | undefined
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (!sdkPromise)
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () =>
        window.Razorpay
          ? resolve()
          : reject(
              new Error('The payment window could not load. Please try again.'),
            )
      script.onerror = () => {
        script.remove()
        reject(
          new Error(
            'The payment window could not load. Please check your connection.',
          ),
        )
      }
      document.head.appendChild(script)
    }).catch((error) => {
      sdkPromise = undefined
      throw error
    })
  return sdkPromise
}
async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(
      result.error || 'The store could not complete this request.',
    )
  return result
}
function readPending(): PaymentResult | null {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem('lumora-pending-payment') || 'null',
    )
    return saved &&
      typeof saved.razorpay_order_id === 'string' &&
      typeof saved.razorpay_payment_id === 'string' &&
      typeof saved.razorpay_signature === 'string'
      ? saved
      : null
  } catch {
    return null
  }
}

export default function Checkout({
  items,
  subtotal,
  onPaid,
  onPaymentWindowOpen,
  onPaymentWindowClose,
}: {
  items: { id: string; quantity: number }[]
  subtotal: number
  onPaid(receipt: string, purchased: { id: string; quantity: number }[]): void
  onPaymentWindowOpen(): void
  onPaymentWindowClose(): void
}) {
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PaymentResult | null>(readPending)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/store', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'The store is temporarily unavailable. Your bag is saved.',
          )
        setConfig(await response.json())
      })
      .catch((error) => {
        if (error.name !== 'AbortError')
          setError(
            'The store is temporarily unavailable. Your bag is saved; please try again later.',
          )
      })
    return () => controller.abort()
  }, [])

  const verify = async (payment: PaymentResult) => {
    setBusy(true)
    setError('')
    setPending(payment)
    try {
      sessionStorage.setItem('lumora-pending-payment', JSON.stringify(payment))
    } catch {
      /* Show the payment reference even if storage is unavailable. */
    }
    try {
      const result = await post('/api/payments/verify', payment)
      if (result.status !== 'paid')
        throw new Error(
          'Payment is awaiting confirmation. Please do not pay again.',
        )
      try {
        sessionStorage.removeItem('lumora-pending-payment')
      } catch {
        /* Verification remains authoritative. */
      }
      setPending(null)
      onPaid(result.receipt, result.items)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Payment confirmation was interrupted. Please retry verification, not payment.',
      )
    } finally {
      setBusy(false)
      onPaymentWindowClose()
    }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!config?.checkoutReady || busy || pending) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const customer = Object.fromEntries(form.entries()) as Record<
      string,
      string
    >
    try {
      await loadRazorpay()
      const order = await post('/api/orders', { items, customer })
      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Lumora',
        description: 'Your candle collection',
        order_id: order.id,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone,
        },
        theme: { color: '#b78344' },
        handler: (result) => {
          void verify(result)
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            onPaymentWindowClose()
          },
        },
      })
      checkout.on('payment.failed', () => {
        setError('Payment was not completed. Your bag is saved.')
        setBusy(false)
      })
      onPaymentWindowOpen()
      checkout.open()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Checkout could not start. No order has been confirmed.',
      )
      setBusy(false)
      onPaymentWindowClose()
    }
  }

  return (
    <section className="checkout-form" aria-labelledby="checkout-heading">
      <h3 id="checkout-heading">A glow, on its way.</h3>
      {error && (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      )}
      {pending ? (
        <div className="checkout-notice">
          <strong>Confirm your payment</strong>
          <p>
            Payment reference: {pending.razorpay_payment_id}. If you paid, do
            not pay again. Retry confirmation to check your existing payment.
          </p>
          <button
            className="button button-dark"
            disabled={busy}
            onClick={() => void verify(pending)}
          >
            {busy ? 'Checking payment…' : 'Retry payment confirmation'}
          </button>
        </div>
      ) : !config ? (
        <p role="status">
          {error
            ? 'Close and reopen checkout to retry.'
            : 'Checking shop availability…'}
        </p>
      ) : !config.checkoutReady ? (
        <div className="checkout-notice" role="status">
          <strong>The shop is getting ready.</strong>
          <p>
            Checkout isn’t enabled yet. No payment has been collected and no
            order has been placed. Your bag stays saved in this browser.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="checkout-intro">
            Delivery within India. Product prices include applicable taxes.
            Payment is handled securely by Razorpay.
          </p>
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={150}
            />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              pattern="[+0-9 ()-]{9,20}"
              maxLength={20}
            />
          </label>
          <label>
            Delivery address
            <input
              name="address"
              autoComplete="street-address"
              required
              minLength={5}
              maxLength={250}
            />
          </label>
          <div className="checkout-fields">
            <label>
              City
              <input
                name="city"
                autoComplete="address-level2"
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              State
              <input
                name="state"
                autoComplete="address-level1"
                required
                minLength={2}
                maxLength={80}
              />
            </label>
          </div>
          <label>
            PIN code
            <input
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
            />
          </label>
          <div className="checkout-breakdown">
            <span>Delivery</span>
            <span>{formatPrice(config.shippingPaise / 100)}</span>
          </div>
          <div className="checkout-breakdown">
            <strong>Total</strong>
            <strong>
              {formatPrice(subtotal + config.shippingPaise / 100)}
            </strong>
          </div>
          <button className="button button-dark" type="submit" disabled={busy}>
            {busy
              ? 'Opening secure payment…'
              : `Pay ${formatPrice(subtotal + config.shippingPaise / 100)} with Razorpay`}
          </button>
          <p className="checkout-intro">
            We use these details to deliver your order. Keep your Razorpay
            payment reference until the order is confirmed.
          </p>
        </form>
      )}
    </section>
  )
}
