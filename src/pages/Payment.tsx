import * as React from "react";
import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PROMO_CODE = "STUDOS2025";
const BASE_PRICE = 30000;
const PROMO_PRICE = 25000;

function formatIDR(num: number) {
  return "Rp. " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function Payment() {
  const [promoInput, setPromoInput] = useState("");
  const [applied, setApplied] = useState(false);

  const finalPrice = applied ? PROMO_PRICE : BASE_PRICE;
  const statusText = applied ? "use promo code" : "not use promo code";

  const qrisData = applied ? "QRIS-PROMO-STUDOS2025" : "QRIS-NORMAL-30000";

  function applyPromo() {
    if (promoInput.trim().toUpperCase() === PROMO_CODE) {
      setApplied(true);
    } else {
      setApplied(false);
      window.alert("Invalid promo code ❌");
    }
  }

  function clearPromo() {
    setPromoInput("");
    setApplied(false);
  }

  function alreadyPaid() {
    // aksi ketika tombol ditekan, misalnya redirect atau notifikasi
    window.alert("Thank you! Payment confirmed ✅");
    // Contoh redirect:
    window.location.href = "/tutorial";
  }

  return (
    <Card className="max-w-xl mx-auto mt-10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Payment</span>
          <Badge variant={applied ? "default" : "secondary"}>{statusText}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* QRIS */}
        <div className="flex flex-col items-center gap-2">
          <QRCodeCanvas value={qrisData} size={200} includeMargin={true} />
          <p className="text-sm text-muted-foreground">
            {applied ? "QRIS pembayaran promo" : "QRIS pembayaran"}
          </p>
        </div>

        {/* Harga */}
        <div className="flex items-end gap-3 justify-center text-black">
          {applied ? (
            <>
              <span className="text-xl line-through text-black">
                {formatIDR(BASE_PRICE)}
              </span>
              <span className="text-3xl font-semibold text-black">
                {formatIDR(finalPrice)}
              </span>
            </>
          ) : (
            <span className="text-3xl font-semibold">{formatIDR(finalPrice)}</span>
          )}
        </div>

        {/* Input promo code */}
        <div className="flex items-center gap-2 text-black">
          <Input
            placeholder="Enter promo code"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPromo();
            }}
          />
          <Button onClick={applyPromo} disabled={!promoInput.trim()}>
            Apply
          </Button>
          {applied && (
            <Button variant="ghost" onClick={clearPromo}>
              Remove
            </Button>
          )}
        </div>

        {/* Ringkasan */}
        <div className="rounded-lg border p-4 space-y-2 bg-card">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-black">{statusText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Promo code</span>
            <span className="font-medium text-black">
              {applied ? PROMO_CODE : "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-lg font-semibold text-black">
              {formatIDR(finalPrice)}
            </span>
          </div>
        </div>

        {/* Button Already Paid */}
        <div className="pt-4 flex justify-center">
          <Button
            onClick={alreadyPaid}
            className="bg-green-600 hover:bg-green-700 text-white w-full"
          >
            Already Paid
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
