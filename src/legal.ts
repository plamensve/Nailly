export type LegalPageKey = 'privacy' | 'terms' | 'gdpr' | 'community';

export const legalPages: Record<LegalPageKey, { title: string; subtitle: string; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How Nailly handles personal data',
    sections: [
      { heading: 'Data we process', body: 'Nailly may process account information such as name, email address, role and profile photo; optional profile information such as city and bio; studio information such as business name, address, phone and description; portfolio images; saved designs; appointment data; ratings and reviews; and technical information needed to operate and secure the service.' },
      { heading: 'Photos and visual search', body: 'Photos you publish as portfolio content are stored so they can be displayed to users. If visual search is enabled, an inspiration image selected for visual search may be sent to the configured matching service to calculate similarity results. Nailly should not use that image for unrelated purposes.' },
      { heading: 'Why we use data', body: 'Data is used to create and secure accounts, provide profiles and studio pages, display portfolio content, save favourites, manage appointment requests, enable mutual ratings, provide visual search when configured, prevent abuse, troubleshoot the service and comply with applicable legal obligations.' },
      { heading: 'Service providers', body: 'Nailly currently uses Supabase for authentication, database and file storage. Apple and Google may process information when the app is distributed through their stores. Additional infrastructure or visual-search providers must be disclosed here before production use if they process personal data.' },
      { heading: 'Retention', body: 'Account data is retained while the account is active and may be retained for a limited additional period when necessary for security, dispute handling or legal obligations. When an account is deleted, associated account data and user-generated content should be deleted unless retention is legally required.' },
      { heading: 'Your choices', body: 'You can update profile information and profile photos in the app. You can request account deletion from the Legal & privacy area. Depending on applicable law, you may also have rights of access, correction, deletion, restriction, portability and objection.' },
      { heading: 'Contact and controller details', body: 'The final production version must identify the legal operator/data controller and provide a working privacy contact address before App Store or Google Play submission.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Rules for using Nailly',
    sections: [
      { heading: 'The service', body: 'Nailly is a marketplace-style service that helps clients discover nail designs and studios, save inspiration and request appointments. Studios are responsible for the services they offer, their prices, availability and fulfilment of appointments.' },
      { heading: 'Accounts', body: 'You are responsible for the accuracy of your account information and for keeping your sign-in credentials secure. Do not impersonate another person or business.' },
      { heading: 'Bookings', body: 'Appointment requests are not guaranteed until confirmed by the relevant studio. Studios and clients should keep availability and booking status accurate and should communicate material changes promptly.' },
      { heading: 'Content', body: 'Only upload images and text you have the right to use. Content that is unlawful, deceptive, abusive, infringing or unrelated to the service may be removed.' },
      { heading: 'Ratings', body: 'Ratings should reflect a genuine appointment experience. Manipulated, retaliatory, discriminatory, threatening or fabricated reviews may be removed or restricted.' },
      { heading: 'Changes and termination', body: 'Nailly may update the service and these terms as the product evolves. Accounts may be restricted for fraud, abuse, security risks or serious violations of these rules.' },
      { heading: 'Production details', body: 'The final production terms must include the legal operator identity, contact details, governing-law information and any market-specific consumer terms required where Nailly is offered.' },
    ],
  },
  gdpr: {
    title: 'Privacy & GDPR Rights',
    subtitle: 'Control over your personal data',
    sections: [
      { heading: 'Access and correction', body: 'You may request information about personal data associated with your account and ask for inaccurate information to be corrected.' },
      { heading: 'Deletion', body: 'You can initiate deletion of your Nailly account from the app. Account deletion is intended to remove the account and associated personal data and user-generated content unless specific information must be retained under applicable law.' },
      { heading: 'Restriction, objection and portability', body: 'Where the GDPR or similar law applies, you may have rights to restrict certain processing, object to certain processing and receive eligible data in a portable format.' },
      { heading: 'Consent', body: 'Where processing relies on consent, you may withdraw that consent. Withdrawal does not affect processing that was lawful before withdrawal.' },
      { heading: 'Complaints', body: 'Where applicable, you may complain to the competent data-protection authority. The production privacy notice must identify the controller and privacy contact so requests can be handled and tracked.' },
    ],
  },
  community: {
    title: 'Community Guidelines',
    subtitle: 'A respectful marketplace for clients and artists',
    sections: [
      { heading: 'Authentic profiles', body: 'Use accurate profile and studio information. Do not impersonate another artist, studio or client.' },
      { heading: 'Portfolio content', body: 'Publish work you own or are authorised to use. Do not upload illegal, hateful, sexually explicit, harassing or privacy-invasive material.' },
      { heading: 'Appointments', body: 'Use booking tools for genuine appointment requests. Repeated fake bookings, deliberate no-shows or abusive cancellations may lead to restrictions.' },
      { heading: 'Ratings and reviews', body: 'Rate only genuine appointment experiences. Keep comments relevant and factual. Do not threaten, harass, discriminate, trade ratings or use reviews as leverage.' },
      { heading: 'Safety and enforcement', body: 'Nailly may investigate reports and remove content, ratings or accounts that violate these rules or create safety, fraud or legal risks.' },
    ],
  },
};
