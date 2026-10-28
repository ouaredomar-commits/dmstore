import React from 'react';
import { useStore } from '../context/StoreContext';
import { ArrowLeft } from 'lucide-react';

export const TermsPage: React.FC = () => {
  const { navigateTo, storeDomain, contactPhone } = useStore();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 bg-white">
      <button
        onClick={() => navigateTo('/')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil</span>
      </button>

      <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-10 space-y-6 text-[#212B36] text-xs sm:text-sm leading-relaxed shadow-md">
        <div className="border-b border-[#DFE3E8] pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6500]">
            Informations Légales
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] mt-1 font-['Plus_Jakarta_Sans']">
            Conditions Générales de Vente (CGV) — DzMahall
          </h1>
          <p className="text-xs text-[#637381] mt-1">Dernière mise à jour : 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">1. Objet & Champ d'Application</h2>
          <p className="text-[#637381]">
            Les présentes Conditions Générales de Vente régissent l'ensemble des commandes passées sur le site indépendant <strong className="text-[#212B36]">{storeDomain}</strong> auprès de la boutique en ligne DzMahall. En passant commande sur la boutique, le client accepte sans réserve les présentes conditions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">2. Mode de Paiement : Paiement à la Livraison (COD)</h2>
          <p className="text-[#637381]">
            DzMahall fonctionne exclusivement selon le principe du <strong>Cash on Delivery (Paiement à la livraison)</strong>. Le client ne règle aucun montant en ligne. Le règlement s'effectue intégralement en espèces (Dinars Algériens - DZD) auprès de l'agent de livraison lors de la remise en main propre du colis ou au guichet du bureau Stop Desk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">3. Confirmation Téléphonique Préalable</h2>
          <p className="text-[#637381]">
            Afin d'éviter toute erreur ou commande non sollicitée, toute commande fait l'objet d'un appel téléphonique ou message de validation par nos opérateurs vers le numéro renseigné par le client avant tout envoi de colis. Une commande non confirmée après 3 tentatives d'appel sera automatiquement annulée.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">4. Délais & Frais de Livraison</h2>
          <p className="text-[#637381]">
            DzMahall assure la livraison dans l'ensemble des 58 Wilayas d'Algérie par le biais de transporteurs partenaires agréés (Yalidine Fast Logistics, Guepex Express, etc.). Les délais indicatifs sont de 24h à 48h pour le Nord et les grands centres urbains, et de 48h à 72h pour les Hauts-Plateaux et le Sud. Les frais de livraison sont calculés en toute transparence lors de la commande selon la wilaya et le mode choisi (domicile ou point relais).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">5. Droit d'Inspection & Retours</h2>
          <p className="text-[#637381]">
            Le client a le droit d'inspecter l'aspect extérieur du colis lors de la livraison. En cas de non-conformité avérée ou de défaut technique constaté dans les 48 heures suivant la réception, un échange ou remboursement sera coordonné par notre service client joignable au <strong className="text-[#212B36]">{contactPhone}</strong>.
          </p>
        </section>
      </div>
    </div>
  );
};

export const PrivacyPage: React.FC = () => {
  const { navigateTo, storeDomain } = useStore();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 bg-white">
      <button
        onClick={() => navigateTo('/')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#637381] hover:text-[#212B36] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil</span>
      </button>

      <div className="bg-[#F4F6F8] border border-[#DFE3E8] rounded-3xl p-6 sm:p-10 space-y-6 text-[#212B36] text-xs sm:text-sm leading-relaxed shadow-md">
        <div className="border-b border-[#DFE3E8] pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6500]">
            Protection des Données
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#212B36] mt-1 font-['Plus_Jakarta_Sans']">
            Politique de Confidentialité — DzMahall
          </h1>
          <p className="text-xs text-[#637381] mt-1">Protection et minimisation des données personnelles</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">1. Principe de Minimisation</h2>
          <p className="text-[#637381]">
            Sur <strong className="text-[#212B36]">{storeDomain}</strong>, nous ne collectons que les informations strictement nécessaires au traitement de votre commande : nom, numéro de téléphone algérien, wilaya, commune et adresse de livraison. Aucune information bancaire (numéro de carte CIB ou Edahabia) n'est jamais demandée ni enregistrée sur notre plateforme.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">2. Partage avec les Transporteurs</h2>
          <p className="text-[#637381]">
            Vos coordonnées de livraison sont exclusivement communiquées au transporteur agréé (ex: Yalidine, Guepex) chargé de vous remettre le colis et de vous contacter lors de son arrivée. Vos données ne sont en aucun cas vendues, cédées ou louées à des tiers publicitaires.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#212B36]">3. Droit d'Accès et de Rectification</h2>
          <p className="text-[#637381]">
            Conformément aux réglementations sur la protection des données personnelles, tout client peut demander la modification ou la suppression de ses données de nos registres de commande en contactant notre service client par WhatsApp ou par e-mail.
          </p>
        </section>
      </div>
    </div>
  );
};
