// Supabase settings for the candidate list.
// Supabase Dashboard -> Project Settings -> API (or "Connect"):
//   supabaseUrl     = Project URL          e.g. https://abcdxyz.supabase.co
//   supabaseAnonKey = anon / publishable key (this key is meant to be public; never put the service_role key here)
// Leave them empty and the candidate list stays hidden; masking still works.
window.AWASTHI_CONFIG = {
  supabaseUrl: "https://yaasnoxuonyvetsonofx.supabase.co",
  supabaseAnonKey: "sb_publishable_0fvTKvYzfEK6WtazopJHUw_BYfi7FxS",
  // last line of the email draft (under "Thanks & Regards,")
  emailSignature: "Ashish Awasthi\nAwasthi HR Associates",
  // red line printed at the bottom of every page of a masked resume ("" switches it off)
  footerText: "Referred by Awasthi HR Associates (Ashish Awasthi)",
  // billing for selected candidates: fee on annual salary, then GST on the fee
  feePercent: 7.5,
  gstPercent: 18,
  // payment is due this many days after the date of joining
  paymentDays: 60,
  // added to the name of every downloaded resume: Name.pdf -> Name_AHRA.pdf
  fileSuffix: "AHRA",
};
