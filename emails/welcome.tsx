import { Body, Button, Container, Head, Html, Preview, Section, Text } from "@react-email/components";

interface Props {
  url: string;
  userFirstname: string | null;
  orgName?: string;
}

export function WelcomeEmail({ userFirstname, orgName, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited to join {orgName ? `the ${orgName}` : "Team Causeway"} portal</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi{userFirstname ? " " + userFirstname : ""},</Text>
          <Text style={paragraph}>
            Welcome to the {orgName} portal! We&apos;re excited to have you on board. To get started, click the button
            below and set a password.
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={url}>
              Get started
            </Button>
          </Section>
          <Text style={paragraph}>
            The link will expire in 15 minutes. You can request a new link from your administrator at any time.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmail.PreviewProps = {
  userFirstname: "Paul",
  orgName: "Non Profit Ally",
  url: "https://np-ally.org",
} as Props;

export default WelcomeEmail;

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
