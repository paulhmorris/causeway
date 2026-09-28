import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

interface Props {
  url: string;
  username: string;
  name: string;
  method: string;
  email?: string | null;
  phone?: string | null;
  message: string;
}

export function NewInquiryEmail({ url, username, email, phone, message, name, method }: Props) {
  return (
    <Html>
      <Head />
      <Preview>There&apos;s a new inquiry</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi there,</Text>
          <Text style={paragraph}>
            There&apos;s a new inquiry from {name} ({username}). They prefer to be contacted via {method}.
          </Text>
          {email ? <Text style={paragraph}>Email: {email}</Text> : null}
          {phone ? <Text style={paragraph}>Phone: {phone}</Text> : null}
          <Hr />
          <Text style={messageStyles}>{message ? message : "No message."}</Text>
          <Section style={btnContainer}>
            <Button style={button} href={url}>
              Log In
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

NewInquiryEmail.PreviewProps = {
  url: "https://np-ally.org",
  name: "John Doe",
  username: "username@example.com",
  method: "Email",
  email: "username@example.com",
  phone: "5555555555",
  message:
    "Culpa laborum qui qui id. Excepteur elit cupidatat occaecat ex eu. Eu aute Lorem veniam ad sint ullamco do enim. Laboris exercitation magna non est nisi. Incididunt culpa id ipsum excepteur quis. Exercitation eiusmod proident non anim veniam et excepteur labore. Laboris elit aliquip commodo minim aute aliqua voluptate cupidatat amet ad. Non sint duis qui et elit minim cillum id ea quis laborum occaecat laboris.",
} as Props;

export default NewInquiryEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};

const messageStyles = {
  fontSize: "16px",
  lineHeight: "26px",
  fontStyle: "italic",
};

const btnContainer = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#4B7081",
  borderRadius: "3px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px",
};
