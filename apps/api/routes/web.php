<?php

use App\Http\Middleware\Capability;
use App\Modules\Catalog\Http\CatalogController;
use App\Modules\Commerce\Http\CommerceController;
use App\Modules\Content\Http\ContentController;
use App\Modules\Delivery\Http\DeliveryController;
use App\Modules\Enquiries\Http\EnquiryController;
use App\Modules\Fulfillment\Http\FulfillmentController;
use App\Modules\Identity\Http\IdentityController;
use App\Modules\Inventory\Http\InventoryController;
use App\Modules\Media\Http\MediaController;
use App\Modules\Payments\Http\PaymentController;
use App\Modules\Reporting\Http\ReportingController;
use App\Support\ProductionConfiguration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

Route::post('/auth/register', [IdentityController::class, 'register'])->defaults('input', 'Register')->name('post_auth_register')->middleware('throttle:login');
Route::post('/auth/login', [IdentityController::class, 'login'])->defaults('input', 'Login')->name('post_auth_login')->middleware('throttle:login');
Route::post('/auth/logout', [IdentityController::class, 'logout'])->middleware(Capability::class.':authenticated')->name('post_auth_logout')->middleware('throttle:login');
Route::post('/auth/forgot-password', [IdentityController::class, 'forgot'])->defaults('input', 'Recovery')->name('post_auth_forgot_password')->middleware('throttle:login');
Route::post('/auth/reset-password', [IdentityController::class, 'reset'])->defaults('input', 'ResetPassword')->name('post_auth_reset_password')->middleware('throttle:login');
Route::post('/auth/email-verification/request', [IdentityController::class, 'verifyRequest'])->middleware(Capability::class.':authenticated')->name('post_auth_email_verification_request')->middleware('throttle:login');
Route::post('/auth/email-verification/confirm', [IdentityController::class, 'verify'])->defaults('input', 'EmailVerify')->name('post_auth_email_verification_confirm')->middleware('throttle:login');
Route::post('/auth/invitations/accept', [IdentityController::class, 'accept'])->defaults('input', 'InviteAccept')->name('post_auth_invitations_accept')->middleware('throttle:login');
Route::get('/api/v1/me', [IdentityController::class, 'me'])->middleware(Capability::class.':authenticated')->name('get_api_v1_me')->middleware('throttle:api');
Route::patch('/api/v1/me', [IdentityController::class, 'profile'])->defaults('input', 'ProfileUpdate')->middleware(Capability::class.':authenticated')->name('patch_api_v1_me')->middleware('throttle:api');
Route::put('/api/v1/me/password', [IdentityController::class, 'password'])->defaults('input', 'PasswordChange')->middleware(Capability::class.':authenticated')->name('put_api_v1_me_password')->middleware('throttle:api');
Route::post('/api/v1/me/email-change', [IdentityController::class, 'emailChange'])->defaults('input', 'EmailChange')->middleware(Capability::class.':authenticated')->name('post_api_v1_me_email_change')->middleware('throttle:api');
Route::post('/api/v1/me/email-change/confirm', [IdentityController::class, 'emailConfirm'])->defaults('input', 'EmailVerify')->middleware(Capability::class.':authenticated')->name('post_api_v1_me_email_change_confirm')->middleware('throttle:api');
Route::put('/api/v1/me/avatar', [MediaController::class, 'avatar'])->defaults('input', 'AvatarAttach')->middleware(Capability::class.':authenticated')->name('put_api_v1_me_avatar')->middleware('throttle:api');
Route::delete('/api/v1/me/avatar', [MediaController::class, 'removeAvatar'])->middleware(Capability::class.':authenticated')->name('delete_api_v1_me_avatar')->middleware('throttle:api');
Route::get('/api/v1/me/addresses', [IdentityController::class, 'addresses'])->middleware(Capability::class.':customer')->name('get_api_v1_me_addresses')->middleware('throttle:api');
Route::post('/api/v1/me/addresses', [IdentityController::class, 'addressSave'])->defaults('input', 'AddressInput')->middleware(Capability::class.':customer')->name('post_api_v1_me_addresses')->middleware('throttle:api');
Route::put('/api/v1/me/addresses/{addressId}', [IdentityController::class, 'addressSave'])->defaults('input', 'AddressInput')->middleware(Capability::class.':customer')->name('put_api_v1_me_addresses_addressId')->middleware('throttle:api');
Route::delete('/api/v1/me/addresses/{addressId}', [IdentityController::class, 'addressDelete'])->middleware(Capability::class.':customer')->name('delete_api_v1_me_addresses_addressId')->middleware('throttle:api');
Route::get('/api/v1/me/orders', [CommerceController::class, 'orders'])->middleware(Capability::class.':customer')->name('get_api_v1_me_orders')->middleware('throttle:api');
Route::get('/api/v1/products', [CatalogController::class, 'products'])->name('get_api_v1_products')->middleware('throttle:api');
Route::get('/api/v1/products/{slug}', [CatalogController::class, 'product'])->name('get_api_v1_products_slug')->middleware('throttle:api');
Route::get('/api/v1/collections', [CatalogController::class, 'collections'])->name('get_api_v1_collections')->middleware('throttle:api');
Route::get('/api/v1/collections/{slug}', [CatalogController::class, 'collection'])->name('get_api_v1_collections_slug')->middleware('throttle:api');
Route::get('/api/v1/content/home', [ContentController::class, 'show'])->name('get_api_v1_content_home')->middleware('throttle:api');
Route::post('/api/v1/delivery/check', [DeliveryController::class, 'check'])->defaults('input', 'DeliveryCheck')->name('post_api_v1_delivery_check')->middleware('throttle:api');
Route::post('/api/v1/enquiries', [EnquiryController::class, 'save'])->defaults('input', 'EnquiryInput')->name('post_api_v1_enquiries')->middleware('throttle:api');
Route::post('/api/v1/cart', [CommerceController::class, 'cart'])->name('post_api_v1_cart')->middleware('throttle:api');
Route::get('/api/v1/cart', [CommerceController::class, 'cart'])->name('get_api_v1_cart')->middleware('throttle:api');
Route::post('/api/v1/cart/items', [CommerceController::class, 'cartMutate'])->defaults('input', 'CartItemAdd')->name('post_api_v1_cart_items')->middleware('throttle:api');
Route::patch('/api/v1/cart/items/{itemId}', [CommerceController::class, 'cartMutate'])->defaults('input', 'CartItemUpdate')->name('patch_api_v1_cart_items_itemId')->middleware('throttle:api');
Route::delete('/api/v1/cart/items/{itemId}', [CommerceController::class, 'cartMutate'])->defaults('input', 'VersionCommand')->name('delete_api_v1_cart_items_itemId')->middleware('throttle:api');
Route::post('/api/v1/order-requests', [CommerceController::class, 'submit'])->defaults('input', 'OrderRequest')->name('post_api_v1_order_requests')->middleware(['throttle:api', 'throttle:order-intake']);
Route::post('/api/v1/guest-order-access/exchange', [CommerceController::class, 'exchange'])->defaults('input', 'TokenExchange')->name('post_api_v1_guest_order_access_exchange')->middleware(['throttle:api', 'throttle:identity-link']);
Route::post('/api/v1/guest-order-access/request', [CommerceController::class, 'accessRequest'])->defaults('input', 'GuestAccessRequest')->name('post_api_v1_guest_order_access_request')->middleware(['throttle:api', 'throttle:identity-link']);
Route::get('/api/v1/orders/{orderId}', [CommerceController::class, 'show'])->name('get_api_v1_orders_orderId')->middleware('throttle:api');
Route::post('/api/v1/orders/{orderId}/claim', [CommerceController::class, 'claim'])->middleware(Capability::class.':verified-customer')->name('post_api_v1_orders_orderId_claim')->middleware('throttle:api');
Route::post('/api/v1/orders/{orderId}/cancel', [CommerceController::class, 'cancel'])->defaults('input', 'Cancel')->name('post_api_v1_orders_orderId_cancel')->middleware('throttle:api');
Route::get('/api/v1/orders/{orderId}/manual-payment-instructions', [PaymentController::class, 'instructions'])->name('get_api_v1_orders_orderId_manual_payment_instructions')->middleware('throttle:api');
Route::post('/api/v1/orders/{orderId}/payment-attempts', [PaymentController::class, 'create'])->defaults('input', 'QuoteAcceptance')->name('post_api_v1_orders_orderId_payment_attempts')->middleware('throttle:api');
Route::post('/api/v1/orders/{orderId}/payment-attempts/{attemptId}/verify', [PaymentController::class, 'verify'])->defaults('input', 'PaymentVerification')->name('post_api_v1_orders_orderId_payment_attempts_attemptId_verify')->middleware('throttle:api');
Route::post('/api/v1/orders/{orderId}/manual-payment-evidence', [PaymentController::class, 'submitEvidence'])->defaults('input', 'EvidenceSubmit')->name('post_api_v1_orders_orderId_manual_payment_evidence')->middleware('throttle:api');
Route::post('/api/v1/media', [MediaController::class, 'upload'])->name('post_api_v1_media')->middleware('throttle:api');
Route::get('/api/v1/media/{mediaId}', [MediaController::class, 'show'])->name('get_api_v1_media_mediaId')->middleware('throttle:api');
Route::post('/webhooks/razorpay', [PaymentController::class, 'webhook'])->name('post_webhooks_razorpay');
Route::get('/api/v1/admin/products', [CatalogController::class, 'products'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_products')->middleware('throttle:api');
Route::post('/api/v1/admin/products', [CatalogController::class, 'productSave'])->defaults('input', 'ProductInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_products')->middleware('throttle:api');
Route::get('/api/v1/admin/products/{productId}', [CatalogController::class, 'adminProduct'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_products_productId')->middleware('throttle:api');
Route::patch('/api/v1/admin/products/{productId}', [CatalogController::class, 'productSave'])->defaults('input', 'ProductUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_products_productId')->middleware('throttle:api');
Route::post('/api/v1/admin/products/{productId}/variants', [CatalogController::class, 'variantCreate'])->defaults('input', 'VariantInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_products_productId_variants')->middleware('throttle:api');
Route::patch('/api/v1/admin/variants/{variantId}', [CatalogController::class, 'variantUpdate'])->defaults('input', 'VariantUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_variants_variantId')->middleware('throttle:api');
Route::post('/api/v1/admin/products/{productId}/images', [CatalogController::class, 'image'])->defaults('input', 'MediaAttach')->middleware(Capability::class.':owner')->name('post_api_v1_admin_products_productId_images')->middleware('throttle:api');
Route::delete('/api/v1/admin/products/{productId}/images/{mediaId}', [CatalogController::class, 'image'])->defaults('input', 'VersionCommand')->middleware(Capability::class.':owner')->name('delete_api_v1_admin_products_productId_images_mediaId')->middleware('throttle:api');
Route::get('/api/v1/admin/collections', [CatalogController::class, 'collections'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_collections')->middleware('throttle:api');
Route::post('/api/v1/admin/collections', [CatalogController::class, 'collectionSave'])->defaults('input', 'CollectionInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_collections')->middleware('throttle:api');
Route::patch('/api/v1/admin/collections/{collectionId}', [CatalogController::class, 'collectionSave'])->defaults('input', 'CollectionUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_collections_collectionId')->middleware('throttle:api');
Route::get('/api/v1/admin/inventory', [InventoryController::class, 'index'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_inventory')->middleware('throttle:api');
Route::get('/api/v1/admin/inventory/{variantId}/movements', [InventoryController::class, 'movements'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_inventory_variantId_movements')->middleware('throttle:api');
Route::post('/api/v1/admin/inventory/{variantId}/adjustments', [InventoryController::class, 'adjust'])->defaults('input', 'StockAdjustment')->middleware(Capability::class.':staff')->name('post_api_v1_admin_inventory_variantId_adjustments')->middleware('throttle:api');
Route::patch('/api/v1/admin/inventory/{variantId}/threshold', [InventoryController::class, 'threshold'])->defaults('input', 'ThresholdUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_inventory_variantId_threshold')->middleware('throttle:api');
Route::get('/api/v1/admin/orders', [CommerceController::class, 'orders'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_orders')->middleware('throttle:api');
Route::post('/api/v1/admin/orders', [CommerceController::class, 'direct'])->defaults('input', 'DirectOrder')->middleware(Capability::class.':staff')->name('post_api_v1_admin_orders')->middleware('throttle:api');
Route::get('/api/v1/admin/orders/{orderId}', [CommerceController::class, 'show'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_orders_orderId')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/shipping-quotes', [CommerceController::class, 'quote'])->defaults('input', 'ShippingQuoteInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_shipping_quotes')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/reservation-extension', [CommerceController::class, 'extend'])->defaults('input', 'ExtendHold')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_reservation_extension')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/cancel', [CommerceController::class, 'cancel'])->defaults('input', 'Cancel')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_cancel')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/packing', [FulfillmentController::class, 'transition'])->defaults('input', 'VersionCommand')->middleware(Capability::class.':staff')->name('post_api_v1_admin_orders_orderId_packing')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/shipment', [FulfillmentController::class, 'transition'])->defaults('input', 'ShipmentInput')->middleware(Capability::class.':staff')->name('post_api_v1_admin_orders_orderId_shipment')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/delivered', [FulfillmentController::class, 'transition'])->defaults('input', 'VersionCommand')->middleware(Capability::class.':staff')->name('post_api_v1_admin_orders_orderId_delivered')->middleware('throttle:api');
Route::get('/api/v1/admin/manual-payment-evidence', [PaymentController::class, 'evidence'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_manual_payment_evidence')->middleware('throttle:api');
Route::post('/api/v1/admin/manual-payment-evidence/{evidenceId}/approve', [PaymentController::class, 'review'])->defaults('input', 'EvidenceApprove')->middleware(Capability::class.':owner')->name('post_api_v1_admin_manual_payment_evidence_evidenceId_approve')->middleware('throttle:api');
Route::post('/api/v1/admin/manual-payment-evidence/{evidenceId}/reject', [PaymentController::class, 'review'])->defaults('input', 'EvidenceReject')->middleware(Capability::class.':owner')->name('post_api_v1_admin_manual_payment_evidence_evidenceId_reject')->middleware('throttle:api');
Route::get('/api/v1/admin/manual-payment-evidence/{evidenceId}/download', [PaymentController::class, 'download'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_manual_payment_evidence_evidenceId_download')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/refunds', [PaymentController::class, 'refund'])->defaults('input', 'RefundRequest')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_refunds')->middleware('throttle:api');
Route::get('/api/v1/admin/refunds/{refundId}', [PaymentController::class, 'refundShow'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_refunds_refundId')->middleware('throttle:api');
Route::post('/api/v1/admin/refunds/{refundId}/manual-confirmation', [PaymentController::class, 'manualRefund'])->defaults('input', 'ManualRefundConfirm')->middleware(Capability::class.':owner')->name('post_api_v1_admin_refunds_refundId_manual_confirmation')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/reconcile-payment', [PaymentController::class, 'reconcile'])->defaults('input', 'VersionCommand')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_reconcile_payment')->middleware('throttle:api');
Route::get('/api/v1/admin/enquiries', [EnquiryController::class, 'index'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_enquiries')->middleware('throttle:api');
Route::post('/api/v1/admin/enquiries', [EnquiryController::class, 'save'])->defaults('input', 'AdminEnquiryInput')->middleware(Capability::class.':staff')->name('post_api_v1_admin_enquiries')->middleware('throttle:api');
Route::get('/api/v1/admin/enquiries/{enquiryId}', [EnquiryController::class, 'show'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_enquiries_enquiryId')->middleware('throttle:api');
Route::patch('/api/v1/admin/enquiries/{enquiryId}', [EnquiryController::class, 'save'])->defaults('input', 'EnquiryUpdate')->middleware(Capability::class.':staff')->name('patch_api_v1_admin_enquiries_enquiryId')->middleware('throttle:api');
Route::get('/api/v1/admin/enquiries/{enquiryId}/notes', [EnquiryController::class, 'notes'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_enquiries_enquiryId_notes')->middleware('throttle:api');
Route::post('/api/v1/admin/enquiries/{enquiryId}/notes', [EnquiryController::class, 'addNote'])->defaults('input', 'NoteInput')->middleware(Capability::class.':staff')->name('post_api_v1_admin_enquiries_enquiryId_notes')->middleware('throttle:api');
Route::get('/api/v1/admin/content/home', [ContentController::class, 'show'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_content_home')->middleware('throttle:api');
Route::put('/api/v1/admin/content/home', [ContentController::class, 'save'])->defaults('input', 'ContentInput')->middleware(Capability::class.':owner')->name('put_api_v1_admin_content_home')->middleware('throttle:api');
Route::get('/api/v1/admin/content/home/preview', [ContentController::class, 'show'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_content_home_preview')->middleware('throttle:api');
Route::post('/api/v1/admin/content/home/publish', [ContentController::class, 'publish'])->defaults('input', 'VersionCommand')->middleware(Capability::class.':owner')->name('post_api_v1_admin_content_home_publish')->middleware('throttle:api');
Route::get('/api/v1/admin/delivery-rules', [DeliveryController::class, 'index'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_delivery_rules')->middleware('throttle:api');
Route::post('/api/v1/admin/delivery-rules', [DeliveryController::class, 'save'])->defaults('input', 'RuleInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_delivery_rules')->middleware('throttle:api');
Route::patch('/api/v1/admin/delivery-rules/{ruleId}', [DeliveryController::class, 'save'])->defaults('input', 'RuleUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_delivery_rules_ruleId')->middleware('throttle:api');
Route::get('/api/v1/admin/team', [IdentityController::class, 'team'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_team')->middleware('throttle:api');
Route::post('/api/v1/admin/invitations', [IdentityController::class, 'invite'])->defaults('input', 'InviteInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_invitations')->middleware('throttle:api');
Route::get('/api/v1/admin/invitations', [IdentityController::class, 'invitations'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_invitations')->middleware('throttle:api');
Route::post('/api/v1/admin/invitations/{invitationId}/revoke', [IdentityController::class, 'revoke'])->middleware(Capability::class.':owner')->name('post_api_v1_admin_invitations_invitationId_revoke')->middleware('throttle:api');
Route::patch('/api/v1/admin/team/{memberId}', [IdentityController::class, 'memberUpdate'])->defaults('input', 'MemberUpdate')->middleware(Capability::class.':owner')->name('patch_api_v1_admin_team_memberId')->middleware('throttle:api');
Route::get('/api/v1/admin/overview', [ReportingController::class, 'overview'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_overview')->middleware('throttle:api');
Route::post('/api/v1/admin/order-exports', [ReportingController::class, 'createExport'])->defaults('input', 'ExportInput')->middleware(Capability::class.':owner')->name('post_api_v1_admin_order_exports')->middleware('throttle:api');
Route::get('/api/v1/admin/order-exports/{exportId}', [ReportingController::class, 'exportShow'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_order_exports_exportId')->middleware('throttle:api');
Route::get('/api/v1/admin/audit', [ReportingController::class, 'audit'])->middleware(Capability::class.':owner')->name('get_api_v1_admin_audit')->middleware('throttle:api');
Route::get('/media/private/{mediaId}', [MediaController::class, 'privateFile'])->middleware(Capability::class.':owner')->name('private-media')->middleware('throttle:api');
Route::get('/api/v1/admin/order-exports/{exportId}/download', [ReportingController::class, 'download'])->middleware(Capability::class.':owner')->name('export-download')->middleware('throttle:api');
Route::post('/api/v1/admin/orders/{orderId}/restock', [PaymentController::class, 'restock'])->defaults('input', 'Cancel')->middleware(Capability::class.':owner')->name('post_api_v1_admin_orders_orderId_restock')->middleware('throttle:api');
Route::get('/media/avatar/{userId}', [MediaController::class, 'avatarFile']);
Route::get('/media/{mediaId}', [MediaController::class, 'publicFile']);
Route::get('/ready', function () {
    try {
        DB::select('SELECT 1');
        Cache::store('redis')->put('readiness', 1, 5);

        if (ProductionConfiguration::issues()) {
            throw new RuntimeException('Configuration unavailable');
        }
        foreach (array_unique([config('auraflare.media_public_disk'), config('auraflare.media_private_disk')]) as $disk) {
            $key = 'health/'.Str::uuid();
            $storage = Storage::disk($disk);
            if (! $storage->put($key, 'ready') || $storage->get($key) !== 'ready' || ! $storage->delete($key)) {
                throw new RuntimeException('Storage unavailable');
            }
        }
        if (config('auraflare.require_background_health') && (! Cache::store('redis')->has('health:worker') || ! Cache::store('redis')->has('health:scheduler'))) {
            throw new RuntimeException('Background services unavailable');
        }

        return response()->json(['status' => 'ready']);
    } catch (Throwable) {
        return response()->json(['status' => 'not_ready'], 503);
    }
});

Route::get('/api/v1/admin/assignees', [IdentityController::class, 'assignees'])->middleware(Capability::class.':staff')->name('get_api_v1_admin_assignees');
